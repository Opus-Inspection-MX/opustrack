"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import {
  assertVicAccess,
  canAccessVic,
  getVicWhereClause,
} from "@/lib/auth/filters";
import { FALLBACK_INCIDENT_TYPE_NAME } from "@/lib/constants/incident-type";
import { prisma } from "@/lib/database/prisma.singleton";
import { INCIDENT_STATE, syncIncidentState } from "@/lib/state-machine";
import { getPrimaryVicId } from "@/lib/utils/vic-assignments";
import {
  BulkIncidentSnapshotRowSchema,
  IncidentClientCreateSchema,
  type IncidentCreateInput,
  IncidentCreateSchema,
  parseAssigneeIds,
} from "@/lib/validations/incidents";

// Keep legacy type for backward compatibility with existing forms
export type IncidentFormData = IncidentCreateInput;

/**
 * Resolve `typeId` ensuring there is always a non-null value. Falls back to
 * the system `Desconocido` type so incidents always satisfy `typeId NOT NULL`.
 */
async function resolveTypeIdOrFallback(
  typeId: number | null | undefined,
): Promise<number> {
  if (typeId) return typeId;
  const fallback = await prisma.incidentType.findUnique({
    where: { name: FALLBACK_INCIDENT_TYPE_NAME },
    select: { id: true },
  });
  if (!fallback) {
    throw new Error(
      `Falta el tipo de incidente "${FALLBACK_INCIDENT_TYPE_NAME}" en el catálogo. Corre el seed.`,
    );
  }
  return fallback.id;
}

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

  const typeId = await resolveTypeIdOrFallback(validated.typeId);

  const incident = await prisma.incident.create({
    data: {
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      typeId,
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

  const typeId = await resolveTypeIdOrFallback(validated.typeId);

  const incident = await prisma.incident.create({
    data: {
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      typeId,
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
/**
 * Reconcile the active set of IncidentAssignee rows for an incident.
 * Throws if removing an FSR that is currently active on an Assignment of
 * this incident (would orphan the work order).
 */
async function syncIncidentAssignees(
  incidentId: number,
  desiredIds: string[],
): Promise<void> {
  const desired = new Set(desiredIds);
  const current = await prisma.incidentAssignee.findMany({
    where: { incidentId, active: true },
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
        assignment: { incidentId, active: true },
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
      where: { incidentId, userId: { in: toRemove }, active: true },
      data: { active: false },
    });
  }

  if (toAdd.length) {
    await prisma.incidentAssignee.createMany({
      data: toAdd.map((userId) => ({ incidentId, userId })),
      skipDuplicates: true,
    });
    await prisma.incidentAssignee.updateMany({
      where: { incidentId, userId: { in: toAdd } },
      data: { active: true },
    });
  }
}

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

  // typeId NOT NULL en BD. Si el caller intenta poner null/undefined, fallback.
  const typeId = data.typeId
    ? data.typeId
    : await resolveTypeIdOrFallback(null);

  // State machine owns statusId/resolvedAt — ignore any caller-provided values.
  const incident = await prisma.incident.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      typeId,
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
    await syncIncidentAssignees(id, data.assigneeIds);
  }

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${id}`);
  revalidatePath("/admin/programacion");
  return { success: true, data: incident };
}

/**
 * Lightweight server action used by quick-edit popovers in lists/calendars.
 * Only touches IncidentAssignee — no other incident fields.
 */
export async function updateIncidentFsrs(
  incidentId: number,
  fsrIds: string[],
): Promise<{ success: true }> {
  const user = await requirePermission("incidents:update");
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { vicId: true },
  });
  if (!incident) {
    throw new Error("Incidente no encontrado");
  }
  assertVicAccess(user, incident.vicId);

  // Validate every FSR exists, is an FSR, and is accessible.
  if (fsrIds.length) {
    const fsrs = await prisma.user.findMany({
      where: {
        id: { in: fsrIds },
        active: true,
        role: { name: "FSR" },
      },
      select: { id: true },
    });
    if (fsrs.length !== new Set(fsrIds).size) {
      throw new Error("Uno o más FSR no existen o no tienen rol FSR");
    }
  }

  await syncIncidentAssignees(incidentId, fsrIds);
  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${incidentId}`);
  revalidatePath("/admin/programacion");
  return { success: true };
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
/**
 * FSRs list with their VIC assignments, used by bulk/quick edit dialogs.
 * Requires `incidents:update` since the caller will modify IncidentAssignee.
 */
export async function getFsrsForAssignment() {
  await requirePermission("incidents:update");
  const fsrs = await prisma.user.findMany({
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
  });
  return fsrs.map((f) => ({
    id: f.id,
    name: f.name,
    email: f.email,
    vicIds: f.vicAssignments.map((va) => va.vicId),
  }));
}

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

  // Filter schedules by VICs the user can access (M:N relationship).
  const isNullFilter =
    vicFilter.vicId &&
    typeof vicFilter.vicId === "object" &&
    "equals" in vicFilter.vicId &&
    vicFilter.vicId.equals === null;
  const scheduleWhere = isNullFilter
    ? {
        active: true,
        vics: { some: { vicId: "__IMPOSSIBLE_VALUE__", active: true } },
      }
    : {
        active: true,
        ...(vicFilter.vicId && typeof vicFilter.vicId === "string"
          ? {
              vics: {
                some: { vicId: vicFilter.vicId, active: true },
              },
            }
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
    prisma.vehicleInspectionCenter.findMany({
      where: {
        active: true,
        ...vicFilter,
      },
      orderBy: { name: "asc" },
    }),
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
  const scheduleWhere = isNullFilter
    ? {
        active: true,
        vics: { some: { vicId: "__IMPOSSIBLE_VALUE__", active: true } },
      }
    : {
        active: true,
        ...(vicFilter.vicId && typeof vicFilter.vicId === "string"
          ? {
              vics: { some: { vicId: vicFilter.vicId, active: true } },
            }
          : {}),
      };

  const [types, statuses, vics, schedules, fsrs] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sla: true },
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
        scheduledAt: true,
        endDate: true,
        vics: {
          where: { active: true },
          select: { vicId: true },
        },
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

  const schedulesWithVicIds = schedules.map((s) => ({
    id: s.id,
    title: s.title,
    scheduledAt: s.scheduledAt,
    endDate: s.endDate,
    vicIds: s.vics.map((v) => v.vicId),
  }));

  return {
    types,
    statuses,
    vics,
    schedules: schedulesWithVicIds,
    fsrs: fsrUsers,
  };
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
  warnings?: Record<string, string>;
};

/**
 * Accent-fold + lowercase a string for forgiving lookup.
 * "Cénac" → "cenac", "Mantenimiento" → "mantenimiento".
 */
function normalizeForMatch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

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

  // Validate schedule access early. Caller must have access to at least one
  // of the schedule's VICs.
  if (scheduleId) {
    const sched = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
      select: {
        id: true,
        vics: {
          where: { active: true },
          select: { vicId: true },
        },
      },
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
    const accessible = sched.vics.some((v) => canAccessVic(user, v.vicId));
    if (!accessible) {
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
    allTypes.map((t) => [normalizeForMatch(t.name), t.id] as const),
  );
  const typesById = new Map(allTypes.map((t) => [t.id, t.name] as const));
  const vicsByCode = new Map(
    allVics.map((v) => [normalizeForMatch(v.code), v.id] as const),
  );
  const vicsById = new Set(allVics.map((v) => v.id));
  const validFsrIds = new Set(allFsrs.map((u) => u.id));

  const errors: BulkIncidentError[] = [];
  const resolved: EditablePreviewRow[] = [];

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const fieldErrors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    if (mode === "template") {
      // Tolerant per-field parsing: invalid/missing values do NOT discard the
      // row. They land in the preview marked with fieldErrors so the user can
      // fix them inline before saving.
      const obj = (raw ?? {}) as Record<string, unknown>;
      const getStr = (k: string): string => {
        const v = obj[k];
        return v == null ? "" : String(v).trim();
      };

      const title = getStr("titulo");
      const description = getStr("descripcion");
      const prioRaw = getStr("prioridad");
      const tipoRaw = getStr("tipo");
      const fechaInicioRaw = getStr("fecha_inicio");
      const vicRaw = getStr("vic");

      // Skip rows that look completely empty (typical trailing rows in Excel).
      if (
        title === "" &&
        description === "" &&
        prioRaw === "" &&
        tipoRaw === "" &&
        fechaInicioRaw === "" &&
        vicRaw === ""
      ) {
        return;
      }

      if (title.length < 3) {
        fieldErrors.titulo = "Título debe tener al menos 3 caracteres";
      }
      if (description.length < 1) {
        fieldErrors.descripcion = "Descripción es requerida";
      }

      let priority = 0;
      if (prioRaw === "") {
        fieldErrors.prioridad = "Prioridad es requerida (1-10)";
      } else {
        const p = Number(prioRaw);
        if (!Number.isFinite(p) || p < 1 || p > 10) {
          fieldErrors.prioridad = `Prioridad inválida: "${prioRaw}"`;
        } else {
          priority = Math.floor(p);
        }
      }

      let startedAt: Date | null = null;
      if (fechaInicioRaw) {
        const d = new Date(fechaInicioRaw);
        if (Number.isNaN(d.getTime())) {
          fieldErrors.fecha_inicio = `Fecha inválida: "${fechaInicioRaw}"`;
        } else {
          startedAt = d;
        }
      }

      const vicCodeRaw = vicRaw || null;
      const vicId = vicCodeRaw
        ? (vicsByCode.get(normalizeForMatch(vicCodeRaw)) ?? null)
        : null;
      if (vicCodeRaw && !vicId) {
        fieldErrors.vic = `VIC "${vicCodeRaw}" no encontrado — selecciona uno`;
      }

      // tipo es opcional: si no resuelve, el server hará fallback a
      // "Desconocido". Conservamos el texto crudo para que el usuario lo vea
      // y pueda corregirlo en el preview si quiere.
      const typeNameRaw = tipoRaw || null;
      const typeId = typeNameRaw
        ? (typesByName.get(normalizeForMatch(typeNameRaw)) ?? null)
        : null;
      if (typeNameRaw && !typeId) {
        warnings.tipo = `Tipo "${typeNameRaw}" no reconocido — se usará "Desconocido"`;
      }

      resolved.push({
        rowNumber,
        title,
        description,
        priority,
        startedAt: toIsoOrNull(startedAt),
        resolvedAt: null,
        vicId,
        vicCodeRaw,
        vicResolved: vicId !== null,
        typeId,
        typeNameRaw,
        // Tipo no encontrado o no especificado: el server hará fallback a
        // "Desconocido" al guardar — no marcar la fila como inválida.
        typeResolved: true,
        assigneeIds: [],
        fieldErrors,
        warnings: Object.keys(warnings).length > 0 ? warnings : undefined,
      });
      return;
    }

    // Snapshot mode — strict integrity check. Any per-field issue is
    // collected in `errors` and the row is dropped from `resolved`. The
    // caller short-circuits on first error so the user sees every problem
    // before anything is loaded into the preview.
    const parsed = BulkIncidentSnapshotRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".") || "_row";
        errors.push({ row: rowNumber, field, message: issue.message });
      }
      return;
    }
    const data = parsed.data;
    let rowOk = true;
    const vicId = data.vicId ?? null;
    if (!vicId) {
      errors.push({
        row: rowNumber,
        field: "vicId",
        message: "vicId requerido en snapshot",
      });
      rowOk = false;
    } else if (!vicsById.has(vicId)) {
      errors.push({
        row: rowNumber,
        field: "vicId",
        message: `VIC ${vicId} no existe o no accesible`,
      });
      rowOk = false;
    }
    const typeId = data.typeId ?? null;
    if (typeId !== null && !typesById.has(typeId)) {
      errors.push({
        row: rowNumber,
        field: "typeId",
        message: `Tipo ${typeId} no existe`,
      });
      rowOk = false;
    }
    const assigneeIds = parseAssigneeIds(data.assigneeIds);
    for (const fsrId of assigneeIds) {
      if (!validFsrIds.has(fsrId)) {
        errors.push({
          row: rowNumber,
          field: "assigneeIds",
          message: `FSR ${fsrId} no existe o sin rol FSR`,
        });
        rowOk = false;
      }
    }
    if (data.startedAt && data.resolvedAt) {
      if (data.resolvedAt.getTime() < data.startedAt.getTime()) {
        errors.push({
          row: rowNumber,
          field: "resolvedAt",
          message: "resolvedAt no puede ser anterior a startedAt",
        });
        rowOk = false;
      }
    }
    if (rowOk) {
      resolved.push({
        rowNumber,
        title: data.title,
        description: data.description,
        priority: data.priority,
        startedAt: toIsoOrNull(data.startedAt),
        resolvedAt: toIsoOrNull(data.resolvedAt),
        vicId,
        vicCodeRaw: null,
        vicResolved: true,
        typeId,
        typeNameRaw: null,
        typeResolved: true,
        assigneeIds,
        fieldErrors,
      });
    }
  });

  // Snapshot is strict: any error blocks the preview entirely.
  if (mode === "snapshot" && errors.length > 0) {
    return { ok: false, errors };
  }
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

  // Validate schedule + collect its VICs for per-row cross-check.
  let scheduleVicIds: Set<string> | null = null;
  if (scheduleId) {
    const sched = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
      select: {
        id: true,
        vics: {
          where: { active: true },
          select: { vicId: true },
        },
      },
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
    const accessible = sched.vics.some((v) => canAccessVic(user, v.vicId));
    if (!accessible) {
      return {
        ok: false,
        errors: [
          { row: 0, message: "Sin acceso a la programación seleccionada" },
        ],
      };
    }
    scheduleVicIds = new Set(sched.vics.map((v) => v.vicId));
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
    } else if (scheduleVicIds && !scheduleVicIds.has(row.vicId)) {
      errors.push({
        row: row.rowNumber,
        field: "vicId",
        message:
          "El VIC de esta fila no está incluido en los VICs de la programación seleccionada",
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

  // Pre-resuelve el typeId fallback una sola vez para todas las filas sin tipo.
  const fallbackTypeId = await resolveTypeIdOrFallback(null);

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const incident = await tx.incident.create({
        data: {
          title: row.title.trim(),
          description: row.description.trim(),
          priority: row.priority,
          typeId: row.typeId ?? fallbackTypeId,
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

export type BulkAssignChanges = {
  /** undefined = no tocar; null = quitar la programación */
  scheduleId?: string | null;
  /** undefined = no tocar */
  vicId?: string;
  /** undefined = no tocar */
  fsrIds?: { ids: string[]; mode: "replace" | "append" };
};

export type BulkAssignResult =
  | { ok: true; updated: number }
  | {
      ok: false;
      errors: Array<{ incidentId: number; message: string }>;
    };

/**
 * Bulk-update a set of incidents in one call. Each change field is optional;
 * pass only what you want to modify. Validates everything per-row and rejects
 * the whole batch (transaction) if any row fails.
 */
export async function bulkAssignIncidents(
  incidentIds: number[],
  changes: BulkAssignChanges,
): Promise<BulkAssignResult> {
  const user = await requirePermission("incidents:update");

  if (!Array.isArray(incidentIds) || incidentIds.length === 0) {
    return {
      ok: false,
      errors: [{ incidentId: 0, message: "No hay incidentes seleccionados" }],
    };
  }
  if (
    changes.scheduleId === undefined &&
    changes.vicId === undefined &&
    changes.fsrIds === undefined
  ) {
    return {
      ok: false,
      errors: [{ incidentId: 0, message: "Nada que modificar" }],
    };
  }

  const incidents = await prisma.incident.findMany({
    where: { id: { in: incidentIds }, active: true },
    select: { id: true, vicId: true },
  });
  const found = new Set(incidents.map((i) => i.id));
  const errors: Array<{ incidentId: number; message: string }> = [];

  for (const id of incidentIds) {
    if (!found.has(id)) {
      errors.push({ incidentId: id, message: "Incidente no encontrado" });
    }
  }

  // Per-incident access check based on current VIC.
  for (const inc of incidents) {
    if (!canAccessVic(user, inc.vicId)) {
      errors.push({
        incidentId: inc.id,
        message: "Sin acceso al VIC actual del incidente",
      });
    }
  }

  // Validate target VIC (single value, applies to all selected).
  if (changes.vicId !== undefined) {
    const targetVic = await prisma.vehicleInspectionCenter.findFirst({
      where: { id: changes.vicId, active: true },
      select: { id: true },
    });
    if (!targetVic) {
      return {
        ok: false,
        errors: [{ incidentId: 0, message: `VIC ${changes.vicId} no existe` }],
      };
    }
    if (!canAccessVic(user, changes.vicId)) {
      return {
        ok: false,
        errors: [{ incidentId: 0, message: "Sin acceso al VIC destino" }],
      };
    }
  }

  // Validate target schedule and its VICs.
  let scheduleVicIds: Set<string> | null = null;
  if (changes.scheduleId !== undefined && changes.scheduleId !== null) {
    const sched = await prisma.schedule.findFirst({
      where: { id: changes.scheduleId, active: true },
      select: {
        id: true,
        vics: { where: { active: true }, select: { vicId: true } },
      },
    });
    if (!sched) {
      return {
        ok: false,
        errors: [
          {
            incidentId: 0,
            message: `Programación ${changes.scheduleId} no existe`,
          },
        ],
      };
    }
    scheduleVicIds = new Set(sched.vics.map((v) => v.vicId));
  }

  // Validate FSRs if any.
  if (changes.fsrIds && changes.fsrIds.ids.length > 0) {
    const fsrs = await prisma.user.findMany({
      where: {
        id: { in: changes.fsrIds.ids },
        active: true,
        role: { name: "FSR" },
      },
      select: { id: true },
    });
    if (fsrs.length !== new Set(changes.fsrIds.ids).size) {
      return {
        ok: false,
        errors: [
          { incidentId: 0, message: "Uno o más FSR no existen o no son FSR" },
        ],
      };
    }
  }

  // Per-incident validation: schedule↔VIC consistency.
  for (const inc of incidents) {
    const effectiveVic = changes.vicId ?? inc.vicId;
    if (scheduleVicIds && effectiveVic && !scheduleVicIds.has(effectiveVic)) {
      errors.push({
        incidentId: inc.id,
        message:
          "El VIC del incidente no está incluido en la programación seleccionada",
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Apply changes in a single transaction.
  await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (changes.scheduleId !== undefined) {
      updateData.scheduleId = changes.scheduleId;
    }
    if (changes.vicId !== undefined) {
      updateData.vicId = changes.vicId;
    }
    if (Object.keys(updateData).length > 0) {
      await tx.incident.updateMany({
        where: { id: { in: [...found] } },
        data: updateData,
      });
    }
  });

  // FSR sync runs outside the transaction to keep behavior identical to
  // updateIncident (and to surface per-incident retire-blocked errors).
  if (changes.fsrIds) {
    const failures: Array<{ incidentId: number; message: string }> = [];
    for (const id of found) {
      try {
        if (changes.fsrIds.mode === "replace") {
          await syncIncidentAssignees(id, changes.fsrIds.ids);
        } else {
          const current = await prisma.incidentAssignee.findMany({
            where: { incidentId: id, active: true },
            select: { userId: true },
          });
          const merged = new Set([
            ...current.map((c) => c.userId),
            ...changes.fsrIds.ids,
          ]);
          await syncIncidentAssignees(id, [...merged]);
        }
      } catch (e) {
        failures.push({
          incidentId: id,
          message: e instanceof Error ? e.message : "Error al actualizar FSRs",
        });
      }
    }
    if (failures.length > 0) {
      return { ok: false, errors: failures };
    }
  }

  revalidatePath("/admin/incidents");
  revalidatePath("/admin/programacion");
  return { ok: true, updated: found.size };
}

/**
 * Cancel an incident. Admin-only terminal action that does not require ODT.
 * Sets statusId to CANCELADA and records cancelledAt + cancellationReason.
 * Once cancelled, all child assignment mutations are blocked.
 */
export async function cancelIncident(incidentId: number, reason?: string) {
  await requirePermission("incidents:cancel");

  const result = await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, status: { select: { name: true } } },
    });
    if (!incident) throw new Error("Incidencia no encontrada");

    const currentStatus = incident.status?.name;
    if (currentStatus === INCIDENT_STATE.CANCELADA) {
      throw new Error("La incidencia ya está cancelada");
    }
    if (currentStatus === INCIDENT_STATE.CERRADO) {
      throw new Error("No se puede cancelar una incidencia cerrada");
    }

    const cancelledStatus = await tx.incidentStatus.findUnique({
      where: { name: INCIDENT_STATE.CANCELADA },
      select: { id: true },
    });
    if (!cancelledStatus) {
      throw new Error(
        "IncidentStatus 'CANCELADA' no existe en el catálogo. Re-ejecuta el seed.",
      );
    }

    const now = new Date();
    const trimmedReason = reason?.trim() || null;

    const updated = await tx.incident.update({
      where: { id: incidentId },
      data: {
        statusId: cancelledStatus.id,
        cancelledAt: now,
        cancellationReason: trimmedReason,
        resolvedAt: now,
      },
    });

    return updated;
  });

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${incidentId}`);
  revalidatePath("/admin/assignments");
  revalidatePath("/fsr/assignments");
  revalidatePath("/fsr/incidents");
  revalidatePath(`/fsr/incidents/${incidentId}`);
  revalidatePath("/client");
  revalidatePath(`/client/incidents/${incidentId}`);

  return { success: true, data: result };
}
