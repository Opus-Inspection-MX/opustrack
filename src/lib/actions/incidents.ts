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
  BulkIncidentSnapshotRowSchema,
  BulkIncidentTemplateRowSchema,
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
      startedAt: validated.startedAt ?? null,
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
      startedAt: data.startedAt ?? null,
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
 * One row in the editable preview UI. Dates are ISO strings to survive the
 * client/server boundary cleanly. FK references carry both the raw text from
 * the CSV (for display when unresolved) and the resolved id (when found).
 */
export type EditablePreviewRow = {
  rowNumber: number;
  title: string;
  description: string;
  priority: number;
  sla: number;
  startedAt: string | null;
  resolvedAt: string | null;
  vicId: string | null;
  vicCodeRaw: string | null;
  vicResolved: boolean;
  typeId: number | null;
  typeNameRaw: string | null;
  typeResolved: boolean;
  assigneeIds: string[];
  fieldErrors: Record<string, string>;
};

export type ResolveBulkResult =
  | { ok: true; rows: EditablePreviewRow[] }
  | { ok: false; errors: BulkIncidentError[] };

function toIsoOrNull(d: Date | undefined | null): string | null {
  if (!d) return null;
  return d.toISOString();
}

/**
 * Validate + resolve raw CSV rows into editable preview rows.
 * Accepts either the legible "template" format (Spanish headers, vic code, type name)
 * or the machine "snapshot" format (English headers, IDs). Does NOT write to DB.
 */
export async function resolveBulkIncidentRows(
  rawRows: unknown[],
  scheduleId: string | null,
  mode: "template" | "snapshot",
): Promise<ResolveBulkResult> {
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

  // Validate schedule access early (single value).
  if (scheduleId) {
    const sched = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
      select: { id: true, vicId: true },
    });
    if (!sched) {
      return {
        ok: false,
        errors: [
          {
            row: 0,
            message: `Programación ${scheduleId} no existe o está inactiva`,
          },
        ],
      };
    }
    if (!canAccessVic(user, sched.vicId)) {
      return {
        ok: false,
        errors: [
          { row: 0, message: "Sin acceso a la programación seleccionada" },
        ],
      };
    }
  }

  // Catalogs for resolution.
  const [allTypes, allVics, allFsrs] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
    prisma.vehicleInspectionCenter.findMany({
      where: { active: true, ...getVicWhereClause(user) },
      select: { id: true, code: true },
    }),
    prisma.user.findMany({
      where: { active: true, role: { name: "FSR" } },
      select: { id: true },
    }),
  ]);

  const typesByName = new Map(
    allTypes.map((t) => [t.name.toLowerCase(), t.id] as const),
  );
  const typesById = new Map(allTypes.map((t) => [t.id, t.name] as const));
  const vicsByCode = new Map(
    allVics.map((v) => [v.code.toLowerCase(), v.id] as const),
  );
  const vicsById = new Set(allVics.map((v) => v.id));
  const validFsrIds = new Set(allFsrs.map((u) => u.id));

  const errors: BulkIncidentError[] = [];
  const resolved: EditablePreviewRow[] = [];

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const fieldErrors: Record<string, string> = {};

    if (mode === "template") {
      const parsed = BulkIncidentTemplateRowSchema.safeParse(raw);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path.join(".") || "_row";
          fieldErrors[field] = issue.message;
          errors.push({ row: rowNumber, field, message: issue.message });
        }
        return;
      }
      const data = parsed.data;
      const vicCodeRaw = data.vic ?? null;
      const vicId = vicCodeRaw
        ? (vicsByCode.get(vicCodeRaw.toLowerCase()) ?? null)
        : null;
      const typeNameRaw = data.tipo ?? null;
      const typeId = typeNameRaw
        ? (typesByName.get(typeNameRaw.toLowerCase()) ?? null)
        : null;
      if (vicCodeRaw && !vicId) {
        fieldErrors.vic = `VIC "${vicCodeRaw}" no encontrado — selecciona uno`;
      }
      if (typeNameRaw && !typeId) {
        fieldErrors.tipo = `Tipo "${typeNameRaw}" no encontrado — selecciona uno`;
      }
      resolved.push({
        rowNumber,
        title: data.titulo,
        description: data.descripcion,
        priority: data.prioridad,
        sla: data.sla,
        startedAt: toIsoOrNull(data.fecha_inicio),
        resolvedAt: null,
        vicId,
        vicCodeRaw,
        vicResolved: vicId !== null,
        typeId,
        typeNameRaw,
        typeResolved: typeId !== null || typeNameRaw === null,
        assigneeIds: [],
        fieldErrors,
      });
      return;
    }

    // snapshot mode
    const parsed = BulkIncidentSnapshotRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".") || "_row";
        fieldErrors[field] = issue.message;
        errors.push({ row: rowNumber, field, message: issue.message });
      }
      return;
    }
    const data = parsed.data;
    const vicId = data.vicId ?? null;
    if (vicId && !vicsById.has(vicId)) {
      fieldErrors.vicId = `VIC ${vicId} no existe o no accesible`;
    }
    const typeId = data.typeId ?? null;
    if (typeId !== null && !typesById.has(typeId)) {
      fieldErrors.typeId = `Tipo ${typeId} no existe`;
    }
    const assigneeIds = parseAssigneeIds(data.assigneeIds);
    const badFsr = assigneeIds.find((id) => !validFsrIds.has(id));
    if (badFsr) {
      fieldErrors.assigneeIds = `FSR ${badFsr} no existe o sin rol FSR`;
    }
    resolved.push({
      rowNumber,
      title: data.title,
      description: data.description,
      priority: data.priority,
      sla: data.sla,
      startedAt: toIsoOrNull(data.startedAt),
      resolvedAt: toIsoOrNull(data.resolvedAt),
      vicId,
      vicCodeRaw: null,
      vicResolved: vicId !== null && vicsById.has(vicId),
      typeId,
      typeNameRaw: null,
      typeResolved: typeId === null || typesById.has(typeId),
      assigneeIds,
      fieldErrors,
    });
  });

  if (errors.length > 0 && resolved.length === 0) {
    return { ok: false, errors };
  }
  return { ok: true, rows: resolved };
}

/**
 * Persist the edited preview rows. Each row is validated again server-side.
 * scheduleId comes from the page-level selector — applied to every row.
 * Rows with resolvedAt populated are created as CERRADO (historical import);
 * otherwise ABIERTO (state machine default).
 */
export async function createIncidentsFromPreview(
  rows: EditablePreviewRow[],
  scheduleId: string | null,
): Promise<BulkIncidentResult> {
  const user = await requirePermission("incidents:create");

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, message: "No hay filas para guardar" }],
    };
  }
  if (rows.length > MAX_BULK_ROWS) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message: `Máximo ${MAX_BULK_ROWS} filas (recibidas: ${rows.length})`,
        },
      ],
    };
  }

  // Resolve open/closed status IDs once.
  const [openStatus, closedStatus] = await Promise.all([
    prisma.incidentStatus.findUnique({
      where: { name: INCIDENT_STATE.ABIERTO },
      select: { id: true },
    }),
    prisma.incidentStatus.findUnique({
      where: { name: INCIDENT_STATE.CERRADO },
      select: { id: true },
    }),
  ]);
  if (!openStatus || !closedStatus) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message: "Estados ABIERTO/CERRADO no existen en el catálogo",
        },
      ],
    };
  }

  // Validate schedule + collect its VIC for cross-check.
  let scheduleVicId: string | null = null;
  if (scheduleId) {
    const sched = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
      select: { id: true, vicId: true },
    });
    if (!sched) {
      return {
        ok: false,
        errors: [
          {
            row: 0,
            message: `Programación ${scheduleId} no existe o está inactiva`,
          },
        ],
      };
    }
    if (!canAccessVic(user, sched.vicId)) {
      return {
        ok: false,
        errors: [
          { row: 0, message: "Sin acceso a la programación seleccionada" },
        ],
      };
    }
    scheduleVicId = sched.vicId;
  }

  // Catalogs for re-validation.
  const vicIds = [
    ...new Set(rows.map((r) => r.vicId).filter((v): v is string => !!v)),
  ];
  const typeIds = [
    ...new Set(
      rows.map((r) => r.typeId).filter((v): v is number => v !== null),
    ),
  ];
  const assigneeIds = [...new Set(rows.flatMap((r) => r.assigneeIds))];

  const [vicsExisting, typesExisting, fsrsExisting] = await Promise.all([
    vicIds.length
      ? prisma.vehicleInspectionCenter.findMany({
          where: { id: { in: vicIds }, active: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    typeIds.length
      ? prisma.incidentType.findMany({
          where: { id: { in: typeIds }, active: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    assigneeIds.length
      ? prisma.user.findMany({
          where: {
            id: { in: assigneeIds },
            active: true,
            role: { name: "FSR" },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);
  const validVics = new Set(vicsExisting.map((v) => v.id));
  const validTypes = new Set(typesExisting.map((t) => t.id));
  const validFsrs = new Set(fsrsExisting.map((u) => u.id));

  const errors: BulkIncidentError[] = [];
  rows.forEach((row) => {
    if (row.title.trim().length < 3) {
      errors.push({
        row: row.rowNumber,
        field: "title",
        message: "Título debe tener al menos 3 caracteres",
      });
    }
    if (row.description.trim().length < 1) {
      errors.push({
        row: row.rowNumber,
        field: "description",
        message: "Descripción es requerida",
      });
    }
    if (row.priority < 1 || row.priority > 10) {
      errors.push({
        row: row.rowNumber,
        field: "priority",
        message: "Prioridad debe estar entre 1 y 10",
      });
    }
    if (row.sla <= 0) {
      errors.push({
        row: row.rowNumber,
        field: "sla",
        message: "SLA debe ser positivo",
      });
    }
    if (!row.vicId) {
      errors.push({
        row: row.rowNumber,
        field: "vicId",
        message: "Selecciona un VIC para esta fila",
      });
    } else if (!validVics.has(row.vicId)) {
      errors.push({
        row: row.rowNumber,
        field: "vicId",
        message: `VIC ${row.vicId} no existe o inactivo`,
      });
    } else if (!canAccessVic(user, row.vicId)) {
      errors.push({
        row: row.rowNumber,
        field: "vicId",
        message: "Sin acceso al VIC seleccionado",
      });
    } else if (scheduleVicId && row.vicId !== scheduleVicId) {
      errors.push({
        row: row.rowNumber,
        field: "vicId",
        message:
          "El VIC de esta fila no coincide con el VIC de la programación seleccionada",
      });
    }
    if (row.typeId !== null && !validTypes.has(row.typeId)) {
      errors.push({
        row: row.rowNumber,
        field: "typeId",
        message: `Tipo ${row.typeId} no existe o inactivo`,
      });
    }
    for (const fsrId of row.assigneeIds) {
      if (!validFsrs.has(fsrId)) {
        errors.push({
          row: row.rowNumber,
          field: "assigneeIds",
          message: `FSR ${fsrId} no existe o sin rol FSR`,
        });
      }
    }
    if (row.startedAt && row.resolvedAt) {
      const start = new Date(row.startedAt).getTime();
      const end = new Date(row.resolvedAt).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
        errors.push({
          row: row.rowNumber,
          field: "resolvedAt",
          message:
            "Fecha de resolución no puede ser anterior a fecha de inicio",
        });
      }
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const incident = await tx.incident.create({
        data: {
          title: row.title.trim(),
          description: row.description.trim(),
          priority: row.priority,
          sla: row.sla,
          typeId: row.typeId,
          statusId: row.resolvedAt ? closedStatus.id : openStatus.id,
          vicId: row.vicId,
          scheduleId,
          reportedById: user.id,
          startedAt: row.startedAt ? new Date(row.startedAt) : null,
          resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : null,
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
  return { ok: true, created: rows.length };
}
