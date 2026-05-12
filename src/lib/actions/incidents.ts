"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import {
  assertVicAccess,
  canAccessVic,
  getVicWhereClause,
} from "@/lib/auth/filters";
import { prisma } from "@/lib/database/prisma.singleton";
import { INCIDENT_STATE, syncIncidentState } from "@/lib/state-machine";
import { getPrimaryVicId } from "@/lib/utils/vic-assignments";
import {
  BulkIncidentRowSchema,
  IncidentClientCreateSchema,
  type IncidentCreateInput,
  IncidentCreateSchema,
  parseAssigneeIds,
} from "@/lib/validations/incidents";

// Keep legacy type for backward compatibility with existing forms
export type IncidentFormData = IncidentCreateInput;

/**
 * Get all incidents with relations
 * Filtered by user's VIC (except ADMINISTRADOR who sees all)
 */
export async function getIncidents() {
  const user = await requirePermission("incidents:read");
  const vicFilter = getVicWhereClause(user);

  const incidents = await prisma.incident.findMany({
    where: {
      active: true,
      ...vicFilter, // Apply VIC filter
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      schedule: true,
      _count: {
        select: { assignments: true },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  return incidents;
}

/**
 * Get incidents related to FSR's assigned work orders
 */
export async function getMyIncidents() {
  const user = await requirePermission("incidents:read");

  const incidents = await prisma.incident.findMany({
    where: {
      active: true,
      assignments: {
        some: {
          assignees: {
            some: { userId: user.id, active: true },
          },
          active: true,
        },
      },
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: { assignments: true },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  return incidents;
}

/**
 * Get single incident by ID
 * Verifies user has access to the incident's VIC
 */
export async function getIncidentById(id: number) {
  const user = await requirePermission("incidents:read");

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      schedule: true,
      assignees: {
        where: { active: true },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      assignments: {
        where: { active: true },
        include: {
          assignees: {
            where: { active: true },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          status: true,
          _count: {
            select: {
              assignmentActivities: true,
              workParts: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!incident) {
    throw new Error("Incident not found");
  }

  // Verify user has access to this incident's VIC
  assertVicAccess(user, incident.vicId);

  return incident;
}

/**
 * Create new incident
 * Validates input with Zod schema
 */
export async function createIncident(data: unknown) {
  const user = await requirePermission("incidents:create");

  // Validate input
  const validated = IncidentCreateSchema.parse(data);

  // State machine: every new incident starts at ABIERTO. Any caller-provided
  // statusId is ignored so the flow can't be skipped.
  const openStatus = await prisma.incidentStatus.findUnique({
    where: { name: INCIDENT_STATE.ABIERTO },
    select: { id: true },
  });
  if (!openStatus) {
    throw new Error(
      `IncidentStatus '${INCIDENT_STATE.ABIERTO}' no existe en el catálogo`,
    );
  }

  const incident = await prisma.incident.create({
    data: {
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      sla: validated.sla,
      typeId: validated.typeId || null,
      statusId: openStatus.id,
      vicId: validated.vicId || null,
      scheduleId: validated.scheduleId || null,
      reportedById: validated.reportedById || user.id,
      resolvedAt: null,
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: true,
    },
  });

  if (validated.assigneeIds?.length) {
    await prisma.incidentAssignee.createMany({
      data: validated.assigneeIds.map((userId) => ({
        incidentId: incident.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/incidents");
  revalidatePath("/client/incidents");
  return { success: true, data: incident };
}

/**
 * Create incident as client (simplified for client role)
 * Validates input with Zod schema
 */
export async function createIncidentAsClient(data: unknown) {
  const user = await requirePermission("incidents:create");

  // Validate input
  const validated = IncidentClientCreateSchema.parse(data);

  // Get ABIERTO status
  const openStatus = await prisma.incidentStatus.findFirst({
    where: { name: INCIDENT_STATE.ABIERTO },
  });

  if (!openStatus) {
    throw new Error(`Estado ${INCIDENT_STATE.ABIERTO} no encontrado`);
  }

  // Client must have a VIC assigned
  const userVicId = await getPrimaryVicId(user.id);
  if (!userVicId) {
    throw new Error("El usuario no tiene un VIC asignado");
  }

  const incident = await prisma.incident.create({
    data: {
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      sla: 24, // Default SLA for client incidents
      typeId: validated.typeId || null,
      statusId: openStatus.id,
      vicId: userVicId,
      reportedById: user.id,
      lineId: validated.lineId || null,
      equipmentId: validated.equipmentId || null,
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  revalidatePath("/client/incidents");
  revalidatePath("/admin/incidents");
  return { success: true, data: incident };
}

/**
 * Get incidents for client (only their VIC)
 */
export async function getClientIncidents() {
  const user = await requirePermission("incidents:read");

  const userVicId = await getPrimaryVicId(user.id);
  if (!userVicId) {
    return [];
  }

  // Client users should only see incidents they reported themselves
  const incidents = await prisma.incident.findMany({
    where: {
      reportedById: user.id, // Filter by the user who reported it
      vicId: userVicId, // Also ensure it's from their VIC
      active: true,
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: { assignments: true },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  return incidents;
}

/**
 * Update existing incident
 * Verifies user has access to the incident's VIC before updating
 */
export async function updateIncident(id: number, data: IncidentFormData) {
  const user = await requirePermission("incidents:update");

  // Verify access before update
  const existing = await prisma.incident.findUnique({
    where: { id },
    select: { vicId: true },
  });

  if (!existing) {
    throw new Error("Incident not found");
  }

  assertVicAccess(user, existing.vicId);

  // State machine owns statusId/resolvedAt — ignore any caller-provided values.
  const incident = await prisma.incident.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      sla: data.sla,
      typeId: data.typeId || null,
      vicId: data.vicId || null,
      scheduleId: data.scheduleId || null,
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: true,
    },
  });

  if (data.assigneeIds !== undefined) {
    const desired = new Set(data.assigneeIds);
    const current = await prisma.incidentAssignee.findMany({
      where: { incidentId: id, active: true },
      select: { userId: true },
    });
    const currentSet = new Set(current.map((c) => c.userId));

    const toRemove = [...currentSet].filter((u) => !desired.has(u));
    const toAdd = [...desired].filter((u) => !currentSet.has(u));

    if (toRemove.length) {
      const inUse = await prisma.assignmentAssignee.findMany({
        where: {
          userId: { in: toRemove },
          active: true,
          assignment: { incidentId: id, active: true },
        },
        select: { userId: true },
      });
      if (inUse.length) {
        const blocked = [...new Set(inUse.map((a) => a.userId))];
        throw new Error(
          `No se puede retirar a FSR(s) asignado(s) a una asignación activa: ${blocked.join(", ")}`,
        );
      }
      await prisma.incidentAssignee.updateMany({
        where: { incidentId: id, userId: { in: toRemove }, active: true },
        data: { active: false },
      });
    }

    if (toAdd.length) {
      await prisma.incidentAssignee.createMany({
        data: toAdd.map((userId) => ({ incidentId: id, userId })),
        skipDuplicates: true,
      });
      await prisma.incidentAssignee.updateMany({
        where: { incidentId: id, userId: { in: toAdd } },
        data: { active: true },
      });
    }
  }

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${id}`);
  return { success: true, data: incident };
}

/**
 * Delete incident (soft delete)
 * Verifies user has access to the incident's VIC before deleting
 * Uses transaction to ensure atomicity when checking for active children
 */
export async function deleteIncident(id: number) {
  const user = await requirePermission("incidents:delete");

  // Verify access before delete
  const incident = await prisma.incident.findUnique({
    where: { id },
    select: { vicId: true },
  });

  if (!incident) {
    throw new Error("Incident not found");
  }

  assertVicAccess(user, incident.vicId);

  // Use transaction to prevent race conditions when checking for children
  await prisma.$transaction(async (tx) => {
    // Check for active assignments
    const activeAssignments = await tx.assignment.count({
      where: { incidentId: id, active: true },
    });

    if (activeAssignments > 0) {
      throw new Error(
        `No se puede eliminar el incidente. Tiene ${activeAssignments} asignación(es) activa(s).`,
      );
    }

    await tx.incident.update({
      where: { id },
      data: { active: false },
    });
  });

  revalidatePath("/admin/incidents");
  redirect("/admin/incidents");
}

/**
 * Recompute and persist this incident's status from its assignments.
 * Use this from admin UIs (e.g., "refresh status") — the incident state
 * is always derived, never set manually.
 */
export async function refreshIncidentStatus(id: number) {
  const user = await requirePermission("incidents:update");
  const incident = await prisma.incident.findUnique({
    where: { id },
    select: { vicId: true },
  });
  if (!incident) {
    throw new Error("Incident not found");
  }
  assertVicAccess(user, incident.vicId);

  const result = await syncIncidentState(id);

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${id}`);
  revalidatePath("/fsr/incidents");
  revalidatePath("/client/incidents");
  return { success: true, before: result.before, after: result.after };
}

/**
 * Force-close an incident. Only succeeds if every assignment is already
 * CERRADO — otherwise the sync will bring the status back automatically.
 */
export async function closeIncident(id: number) {
  const user = await requirePermission("incidents:close");

  const incident = await prisma.incident.findUnique({
    where: { id },
    select: { vicId: true },
  });
  if (!incident) {
    throw new Error("Incident not found");
  }
  assertVicAccess(user, incident.vicId);

  const result = await syncIncidentState(id);
  if (result.after !== INCIDENT_STATE.CERRADO) {
    throw new Error(
      "No se puede cerrar la incidencia: aún tiene asignaciones abiertas",
    );
  }

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${id}`);
  revalidatePath("/fsr/incidents");
  revalidatePath("/client/incidents");
  return { success: true };
}

/**
 * Get FSR users for assignment
 * Filtered by user's VIC (except ADMINISTRADOR who sees all FSRs)
 */
export async function getFSRUsers() {
  const user = await requirePermission("incidents:assign");
  const vicFilter = getVicWhereClause(user);

  const fsrRole = await prisma.role.findUnique({
    where: { name: "FSR" },
  });

  if (!fsrRole) {
    return [];
  }

  const fsrUsers = await prisma.user.findMany({
    where: {
      roleId: fsrRole.id,
      active: true,
      ...vicFilter, // Only FSRs from same VIC
    },
    select: {
      id: true,
      name: true,
      email: true,
      vic: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return fsrUsers;
}

/**
 * Get form options for incidents
 * VICs and schedules filtered by user's VIC (except ADMINISTRADOR)
 */
export async function getIncidentFormOptions() {
  const user = await requirePermission("incidents:read");
  const vicFilter = getVicWhereClause(user);

  // Schedule.vicId is required (not nullable), so handle vicFilter specially
  // If user has no VIC (vicFilter tries to match null), return impossible value to get empty result
  const isNullFilter =
    vicFilter.vicId &&
    typeof vicFilter.vicId === "object" &&
    "equals" in vicFilter.vicId &&
    vicFilter.vicId.equals === null;
  const scheduleWhere: { active: boolean; vicId?: string } = isNullFilter
    ? { active: true, vicId: "__IMPOSSIBLE_VALUE__" }
    : {
        active: true,
        ...(vicFilter.vicId && typeof vicFilter.vicId === "string"
          ? { vicId: vicFilter.vicId }
          : {}),
      };

  const [types, statuses, vics, users, schedules] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.incidentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    // Filter VICs by user's access
    prisma.vehicleInspectionCenter.findMany({
      where: {
        active: true,
        ...vicFilter,
      },
      orderBy: { name: "asc" },
    }),
    // Users not filtered by VIC (may need to see reporters from other VICs)
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        vicAssignments: {
          where: { active: true },
          select: { vicId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    // Filter schedules by VIC (Schedule.vicId is required, so handle null case specially)
    prisma.schedule.findMany({
      where: scheduleWhere,
      orderBy: { scheduledAt: "desc" },
      take: 50,
    }),
  ]);

  const usersWithVicIds = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleName: u.role?.name ?? null,
    vicIds: u.vicAssignments.map((va) => va.vicId),
  }));

  return { types, statuses, vics, users: usersWithVicIds, schedules };
}

/**
 * Catalogs needed to fill the bulk-incident CSV.
 * Filters by user's VIC access (admin sees all).
 */
export async function getBulkIncidentCatalogs() {
  const user = await requirePermission("incidents:create");
  const vicFilter = getVicWhereClause(user);

  const isNullFilter =
    vicFilter.vicId &&
    typeof vicFilter.vicId === "object" &&
    "equals" in vicFilter.vicId &&
    vicFilter.vicId.equals === null;
  const scheduleWhere: { active: boolean; vicId?: string } = isNullFilter
    ? { active: true, vicId: "__IMPOSSIBLE_VALUE__" }
    : {
        active: true,
        ...(vicFilter.vicId && typeof vicFilter.vicId === "string"
          ? { vicId: vicFilter.vicId }
          : {}),
      };

  const [types, statuses, vics, schedules, fsrs] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.incidentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.vehicleInspectionCenter.findMany({
      where: { active: true, ...vicFilter },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.schedule.findMany({
      where: scheduleWhere,
      orderBy: { scheduledAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        type: true,
        scheduledAt: true,
        vicId: true,
      },
    }),
    prisma.user.findMany({
      where: { active: true, role: { name: "FSR" } },
      select: {
        id: true,
        name: true,
        email: true,
        vicAssignments: {
          where: { active: true },
          select: { vicId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const fsrUsers = fsrs.map((f) => ({
    id: f.id,
    name: f.name,
    email: f.email,
    vicIds: f.vicAssignments.map((va) => va.vicId),
  }));

  return { types, statuses, vics, schedules, fsrs: fsrUsers };
}

export type BulkIncidentError = {
  row: number;
  field?: string;
  message: string;
};

export type BulkIncidentResult =
  | { ok: true; created: number }
  | { ok: false; errors: BulkIncidentError[] };

const MAX_BULK_ROWS = 500;

/**
 * Atomically create many incidents from CSV-parsed rows.
 * If any row is invalid (schema or cross-validation), no incidents are created.
 */
export async function createIncidentsBulk(
  rawRows: unknown[],
): Promise<BulkIncidentResult> {
  const user = await requirePermission("incidents:create");

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, message: "No hay filas para procesar" }],
    };
  }

  if (rawRows.length > MAX_BULK_ROWS) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message: `Máximo ${MAX_BULK_ROWS} filas por carga (recibidas: ${rawRows.length})`,
        },
      ],
    };
  }

  const errors: BulkIncidentError[] = [];
  const parsedRows: Array<{
    title: string;
    description: string;
    priority: number;
    sla: number;
    typeId?: number;
    statusId?: number;
    vicId?: string;
    scheduleId?: string;
    assigneeIds: string[];
  }> = [];

  rawRows.forEach((raw, idx) => {
    const result = BulkIncidentRowSchema.safeParse(raw);
    const rowNumber = idx + 2; // +2: header row + 1-based
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path.join("."),
          message: issue.message,
        });
      }
      return;
    }
    parsedRows.push({
      title: result.data.title,
      description: result.data.description,
      priority: result.data.priority,
      sla: result.data.sla,
      typeId: result.data.typeId,
      statusId: result.data.statusId,
      vicId: result.data.vicId,
      scheduleId: result.data.scheduleId,
      assigneeIds: parseAssigneeIds(result.data.assigneeIds),
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Cross-validation against catalogs
  const typeIds = new Set(
    parsedRows.map((r) => r.typeId).filter((v): v is number => v !== undefined),
  );
  const statusIds = new Set(
    parsedRows
      .map((r) => r.statusId)
      .filter((v): v is number => v !== undefined),
  );
  const vicIds = new Set(
    parsedRows.map((r) => r.vicId).filter((v): v is string => v !== undefined),
  );
  const scheduleIds = new Set(
    parsedRows
      .map((r) => r.scheduleId)
      .filter((v): v is string => v !== undefined),
  );
  const assigneeIds = new Set(parsedRows.flatMap((r) => r.assigneeIds));

  const [
    existingTypes,
    existingStatuses,
    existingVics,
    existingSchedules,
    existingFsrs,
  ] = await Promise.all([
    typeIds.size
      ? prisma.incidentType.findMany({
          where: { id: { in: [...typeIds] }, active: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    statusIds.size
      ? prisma.incidentStatus.findMany({
          where: { id: { in: [...statusIds] }, active: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    vicIds.size
      ? prisma.vehicleInspectionCenter.findMany({
          where: { id: { in: [...vicIds] }, active: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    scheduleIds.size
      ? prisma.schedule.findMany({
          where: { id: { in: [...scheduleIds] }, active: true },
          select: { id: true, vicId: true },
        })
      : Promise.resolve([]),
    assigneeIds.size
      ? prisma.user.findMany({
          where: {
            id: { in: [...assigneeIds] },
            active: true,
            role: { name: "FSR" },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const validTypes = new Set(existingTypes.map((t) => t.id));
  const validStatuses = new Set(existingStatuses.map((s) => s.id));
  const validVics = new Set(existingVics.map((v) => v.id));
  const scheduleVicById = new Map(
    existingSchedules.map((s) => [s.id, s.vicId]),
  );
  const validFsrs = new Set(existingFsrs.map((u) => u.id));

  parsedRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    if (row.typeId !== undefined && !validTypes.has(row.typeId)) {
      errors.push({
        row: rowNumber,
        field: "typeId",
        message: `Tipo de incidente ${row.typeId} no existe o está inactivo`,
      });
    }
    if (row.statusId !== undefined && !validStatuses.has(row.statusId)) {
      errors.push({
        row: rowNumber,
        field: "statusId",
        message: `Estado ${row.statusId} no existe o está inactivo`,
      });
    }
    if (row.vicId !== undefined) {
      if (!validVics.has(row.vicId)) {
        errors.push({
          row: rowNumber,
          field: "vicId",
          message: `VIC ${row.vicId} no existe o está inactivo`,
        });
      } else if (!canAccessVic(user, row.vicId)) {
        errors.push({
          row: rowNumber,
          field: "vicId",
          message: `Sin acceso al VIC ${row.vicId}`,
        });
      }
    }
    if (row.scheduleId !== undefined) {
      const scheduleVic = scheduleVicById.get(row.scheduleId);
      if (scheduleVic === undefined) {
        errors.push({
          row: rowNumber,
          field: "scheduleId",
          message: `Programación ${row.scheduleId} no existe o está inactiva`,
        });
      } else if (!canAccessVic(user, scheduleVic)) {
        errors.push({
          row: rowNumber,
          field: "scheduleId",
          message: `Sin acceso a la programación ${row.scheduleId}`,
        });
      }
    }
    for (const fsrId of row.assigneeIds) {
      if (!validFsrs.has(fsrId)) {
        errors.push({
          row: rowNumber,
          field: "assigneeIds",
          message: `FSR ${fsrId} no existe, está inactivo o no tiene rol FSR`,
        });
      }
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  await prisma.$transaction(async (tx) => {
    for (const row of parsedRows) {
      const incident = await tx.incident.create({
        data: {
          title: row.title,
          description: row.description,
          priority: row.priority,
          sla: row.sla,
          typeId: row.typeId ?? null,
          statusId: row.statusId ?? null,
          vicId: row.vicId ?? null,
          scheduleId: row.scheduleId ?? null,
          reportedById: user.id,
        },
      });
      if (row.assigneeIds.length > 0) {
        await tx.incidentAssignee.createMany({
          data: row.assigneeIds.map((userId) => ({
            incidentId: incident.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    }
  });

  revalidatePath("/admin/incidents");
  revalidatePath("/client/incidents");
  return { ok: true, created: parsedRows.length };
}
