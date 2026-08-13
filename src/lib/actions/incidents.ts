"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import {
  assertClienteAccess,
  canAccessCliente,
  getClienteWhereClause,
} from "@/lib/auth/filters";
import { FALLBACK_INCIDENT_TYPE_NAME } from "@/lib/constants/incident-type";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  notifyIncidentCreated,
  notifyIncidentUpdated,
} from "@/lib/notifications";
import { INCIDENT_STATE, syncIncidentState } from "@/lib/state-machine";
import { getPrimaryClienteId } from "@/lib/utils/cliente-assignments";
import { parseMxDateTime } from "@/lib/utils/datetime";
import {
  BulkIncidentSnapshotRowSchema,
  IncidentClientCreateSchema,
  type IncidentCreateInput,
  IncidentCreateSchema,
  parseAssigneeIds,
} from "@/lib/validations/incidents";
import { type ActionResult, businessRule, guarded } from "./result";

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

type GetIncidentsParams = {
  page?: number;
  limit?: number;
  search?: string;
};

/**
 * Get incidents with relations, paginated and searchable (title, description).
 * Filtered by user's Cliente (except ADMINISTRADOR who sees all).
 */
export async function getIncidents(params?: GetIncidentsParams) {
  const user = await requirePermission("incidents:read");
  const clienteFilter = getClienteWhereClause(user);

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const skip = (page - 1) * limit;
  const search = params?.search?.trim();

  const where: Prisma.IncidentWhereInput = {
    active: true,
    ...clienteFilter, // Apply Cliente filter
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: {
        type: true,
        status: true,
        cliente: true,
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
      skip,
      take: limit,
    }),
    prisma.incident.count({ where }),
  ]);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
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
      cliente: true,
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
 * Verifies user has access to the incident's Cliente
 */
export async function getIncidentById(id: number) {
  const user = await requirePermission("incidents:read");

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      type: true,
      status: true,
      cliente: true,
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

  // Verify user has access to this incident's Cliente
  assertClienteAccess(user, incident.clienteId);

  return incident;
}

/**
 * Create new incident
 * Validates input with Zod schema
 */
export async function createIncident(data: unknown) {
  const user = await requirePermission("incidents:create");

  return guarded(async () => {
    // Validate input
    const validated = IncidentCreateSchema.parse(data);

    // State machine: every new incident starts at ABIERTO. Any caller-provided
    // statusId is ignored so the flow can't be skipped.
    const initialStatus = await prisma.incidentStatus.findUnique({
      where: { name: INCIDENT_STATE.ABIERTO },
      select: { id: true },
    });
    if (!initialStatus) {
      throw new Error(
        `IncidentStatus '${INCIDENT_STATE.ABIERTO}' no existe en el catálogo`,
      );
    }

    const typeId = await resolveTypeIdOrFallback(validated.typeId);

    const incident = await prisma.incident.create({
      data: {
        title: validated.title,
        description: validated.description,
        typeId,
        statusId: initialStatus.id,
        clienteId: validated.clienteId || null,
        scheduleId: validated.scheduleId || null,
        reportedById: validated.reportedById || user.id,
        startedAt: validated.startedAt ?? null,
        resolvedAt: null,
      },
      include: {
        type: true,
        status: true,
        cliente: true,
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

      // Give the pre-selected FSRs a real Assignment they can see, and
      // notify them — otherwise they're only "enabled" with no visible work.
      const { ensureFsrsAssignedToIncident } = await import(
        "@/lib/actions/assignments"
      );
      await ensureFsrsAssignedToIncident(
        incident.id,
        validated.assigneeIds,
        user.id,
      );
    }

    // POST-tx: notify admins of new incident (RF-465). Never throws.
    await notifyIncidentCreated(incident.id, incident.title, user.id);

    revalidatePath("/admin/incidents");
    revalidatePath("/client/incidents");
    return { data: incident };
  });
}

/**
 * Create incident as client (simplified for client role)
 * Validates input with Zod schema
 */
export async function createIncidentAsClient(data: unknown) {
  const user = await requirePermission("incidents:create");

  return guarded(async () => {
    // Validate input
    const validated = IncidentClientCreateSchema.parse(data);

    // Get initial status: new incidents start at ABIERTO.
    const initialStatus = await prisma.incidentStatus.findFirst({
      where: { name: INCIDENT_STATE.ABIERTO },
    });

    if (!initialStatus) {
      throw new Error(`Estado ${INCIDENT_STATE.ABIERTO} no encontrado`);
    }

    // Client must have a Cliente assigned
    const userClienteId = await getPrimaryClienteId(user.id);
    if (!userClienteId) {
      businessRule("El usuario no tiene un Cliente asignado");
    }

    const typeId = await resolveTypeIdOrFallback(validated.typeId);

    const incident = await prisma.incident.create({
      data: {
        title: validated.title,
        description: validated.description,
        typeId,
        statusId: initialStatus.id,
        clienteId: userClienteId,
        reportedById: user.id,
        lineId: validated.lineId || null,
        equipmentId: validated.equipmentId || null,
      },
      include: {
        type: true,
        status: true,
        cliente: true,
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // POST-tx: notify admins of new incident (RF-465). Never throws.
    await notifyIncidentCreated(incident.id, incident.title, user.id);

    revalidatePath("/client/incidents");
    revalidatePath("/admin/incidents");
    return { data: incident };
  });
}

/**
 * Get incidents for client (only their Cliente)
 */
export async function getClientIncidents() {
  const user = await requirePermission("incidents:read");

  const userClienteId = await getPrimaryClienteId(user.id);
  if (!userClienteId) {
    return [];
  }

  // Client users should only see incidents they reported themselves
  const incidents = await prisma.incident.findMany({
    where: {
      reportedById: user.id, // Filter by the user who reported it
      clienteId: userClienteId, // Also ensure it's from their Cliente
      active: true,
    },
    include: {
      type: true,
      status: true,
      cliente: true,
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
 * Verifies user has access to the incident's Cliente before updating
 */
/**
 * Reconcile the active set of IncidentAssignee rows for an incident.
 * Throws if removing an FSR that is currently active on an Assignment of
 * this incident (would orphan the work order).
 */
async function syncIncidentAssignees(
  incidentId: number,
  desiredIds: string[],
): Promise<{ toAdd: string[] }> {
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
      businessRule(
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

  return { toAdd };
}

export async function updateIncident(id: number, data: IncidentFormData) {
  const user = await requirePermission("incidents:update");

  return guarded(async () => {
    // Verify access before update
    const existing = await prisma.incident.findUnique({
      where: { id },
      select: { clienteId: true },
    });

    if (!existing) {
      throw new Error("Incident not found");
    }

    assertClienteAccess(user, existing.clienteId);

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
        typeId,
        clienteId: data.clienteId || null,
        scheduleId: data.scheduleId || null,
        startedAt: data.startedAt ?? null,
      },
      include: {
        type: true,
        status: true,
        cliente: true,
        reportedBy: true,
      },
    });

    let toAdd: string[] = [];
    if (data.assigneeIds !== undefined) {
      ({ toAdd } = await syncIncidentAssignees(id, data.assigneeIds));
    }

    // POST-tx: notify incident FSR events (RF-466, RF-468). Both never-throw.
    // Fetch existing active IncidentAssignees (excluding newly added) for INCIDENT_UPDATED.
    const existingFsrRows = await prisma.incidentAssignee.findMany({
      where: { incidentId: id, active: true, userId: { notIn: toAdd } },
      select: { userId: true },
    });
    const existingFsrIds = existingFsrRows.map((r) => r.userId);
    if (existingFsrIds.length > 0) {
      await notifyIncidentUpdated(id, incident.title, existingFsrIds, user.id);
    }
    if (toAdd.length > 0) {
      const { ensureFsrsAssignedToIncident } = await import(
        "@/lib/actions/assignments"
      );
      await ensureFsrsAssignedToIncident(id, toAdd, user.id);
    }

    revalidatePath("/admin/incidents");
    revalidatePath(`/admin/incidents/${id}`);
    revalidatePath("/admin/programacion");
    return { data: incident };
  });
}

/**
 * Lightweight server action used by quick-edit popovers in lists/calendars.
 * Only touches IncidentAssignee — no other incident fields.
 */
export async function updateIncidentFsrs(
  incidentId: number,
  fsrIds: string[],
): Promise<ActionResult> {
  const user = await requirePermission("incidents:update");

  return guarded(async () => {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { clienteId: true, title: true },
    });
    if (!incident) {
      throw new Error("Incidente no encontrado");
    }
    assertClienteAccess(user, incident.clienteId);

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
        businessRule("Uno o más FSR no existen o no tienen rol FSR");
      }
    }

    const { toAdd } = await syncIncidentAssignees(incidentId, fsrIds);

    // POST-tx: give newly-enabled FSRs a real Assignment they can see, and
    // notify them (RF-468). Eligibility alone used to leave them with a
    // notification but no visible work.
    if (toAdd.length > 0) {
      const { ensureFsrsAssignedToIncident } = await import(
        "@/lib/actions/assignments"
      );
      await ensureFsrsAssignedToIncident(incidentId, toAdd, user.id);
    }

    revalidatePath("/admin/incidents");
    revalidatePath(`/admin/incidents/${incidentId}`);
    revalidatePath("/admin/programacion");
    return {};
  });
}

/**
 * Quick-edit the incident's scheduled start date from the
 * "Asignación de Programación" screen. Updates the linked Schedule's
 * scheduledAt; if the incident has no schedule yet, creates a minimal one and
 * links it (mirrors the create-incident dialog flow).
 *
 * NOTE: when several incidents share the same Schedule, changing the date
 * affects all of them. In the common flow each incident gets its own schedule.
 */
export async function updateIncidentScheduledDate(
  incidentId: number,
  scheduledAtISO: string,
): Promise<ActionResult> {
  const user = await requirePermission("incidents:update");

  return guarded(async () => {
    const scheduledAt = new Date(scheduledAtISO);
    if (Number.isNaN(scheduledAt.getTime())) {
      businessRule("Fecha inválida");
    }

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        clienteId: true,
        scheduleId: true,
        title: true,
        description: true,
      },
    });
    if (!incident) {
      throw new Error("Incidente no encontrado");
    }
    assertClienteAccess(user, incident.clienteId);

    if (incident.scheduleId) {
      await prisma.schedule.update({
        where: { id: incident.scheduleId },
        data: { scheduledAt },
      });
    } else {
      const schedule = await prisma.schedule.create({
        data: {
          title: incident.title,
          description: incident.description,
          scheduledAt,
        },
      });
      await prisma.incident.update({
        where: { id: incidentId },
        data: { scheduleId: schedule.id },
      });
    }

    revalidatePath("/admin/programacion");
    revalidatePath("/admin/incidents");
    revalidatePath(`/admin/incidents/${incidentId}`);
    return {};
  });
}

/**
 * Quick-edit the incident type from the "Asignación de Programación" screen.
 */
export async function updateIncidentType(
  incidentId: number,
  typeId: number,
): Promise<ActionResult> {
  const user = await requirePermission("incidents:update");

  return guarded(async () => {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { clienteId: true },
    });
    if (!incident) {
      throw new Error("Incidente no encontrado");
    }
    assertClienteAccess(user, incident.clienteId);

    const type = await prisma.incidentType.findFirst({
      where: { id: typeId, active: true },
      select: { id: true },
    });
    if (!type) {
      businessRule("Tipo de incidente no válido");
    }

    await prisma.incident.update({
      where: { id: incidentId },
      data: { typeId },
    });

    revalidatePath("/admin/programacion");
    revalidatePath("/admin/incidents");
    revalidatePath(`/admin/incidents/${incidentId}`);
    return {};
  });
}

/**
 * Delete incident (soft delete)
 * Verifies user has access to the incident's Cliente before deleting
 * Uses transaction to ensure atomicity when checking for active children
 */
export async function deleteIncident(id: number) {
  const user = await requirePermission("incidents:delete");

  return guarded(async () => {
    // Verify access before delete
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: { clienteId: true },
    });

    if (!incident) {
      throw new Error("Incident not found");
    }

    assertClienteAccess(user, incident.clienteId);

    // Use transaction to prevent race conditions when checking for children
    await prisma.$transaction(async (tx) => {
      // Check for active assignments
      const activeAssignments = await tx.assignment.count({
        where: { incidentId: id, active: true },
      });

      if (activeAssignments > 0) {
        businessRule(
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
  });
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
    select: { clienteId: true },
  });
  if (!incident) {
    throw new Error("Incident not found");
  }
  assertClienteAccess(user, incident.clienteId);

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

  return guarded(async () => {
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: { clienteId: true },
    });
    if (!incident) {
      throw new Error("Incident not found");
    }
    assertClienteAccess(user, incident.clienteId);

    const result = await syncIncidentState(id);
    if (result.after !== INCIDENT_STATE.CERRADO) {
      businessRule(
        "No se puede cerrar la incidencia: aún tiene asignaciones abiertas",
      );
    }

    revalidatePath("/admin/incidents");
    revalidatePath(`/admin/incidents/${id}`);
    revalidatePath("/fsr/incidents");
    revalidatePath("/client/incidents");
    return {};
  });
}

/**
 * Get FSR users for assignment
 * Filtered by user's Cliente (except ADMINISTRADOR who sees all FSRs)
 */
/**
 * FSRs list with their Cliente assignments, used by bulk/quick edit dialogs.
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
      clienteAssignments: {
        where: { active: true },
        select: { clienteId: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return fsrs.map((f) => ({
    id: f.id,
    name: f.name,
    email: f.email,
    clienteIds: f.clienteAssignments.map((va) => va.clienteId),
  }));
}

export async function getFSRUsers() {
  const user = await requirePermission("incidents:assign");
  const clienteFilter = getClienteWhereClause(user);

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
      ...clienteFilter, // Only FSRs from same Cliente
    },
    select: {
      id: true,
      name: true,
      email: true,
      cliente: {
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
 * Clientes and schedules filtered by user's Cliente (except ADMINISTRADOR)
 */
export async function getIncidentFormOptions() {
  const user = await requirePermission("incidents:read");
  const clienteFilter = getClienteWhereClause(user);

  // Filter schedules by Clientes the user can access (M:N relationship).
  // Schedules without any active Clientes are considered global and always shown.
  const isNullFilter =
    clienteFilter.clienteId &&
    typeof clienteFilter.clienteId === "object" &&
    "equals" in clienteFilter.clienteId &&
    clienteFilter.clienteId.equals === null;
  const scheduleWhere = isNullFilter
    ? {
        active: true,
        // User has no accessible Cliente: show only clienteless (global) schedules.
        clientes: { none: { active: true } },
      }
    : {
        active: true,
        ...(clienteFilter.clienteId &&
        typeof clienteFilter.clienteId === "string"
          ? {
              // Include schedules linked to this specific Cliente OR global schedules
              // (no active Cliente links) so that client-less schedules are always shown.
              OR: [
                {
                  clientes: {
                    some: { clienteId: clienteFilter.clienteId, active: true },
                  },
                },
                { clientes: { none: { active: true } } },
              ],
            }
          : {}),
      };

  const [types, statuses, clientes, users, schedules] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.incidentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.cliente.findMany({
      where: {
        active: true,
        ...clienteFilter,
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
        clienteAssignments: {
          where: { active: true },
          select: { clienteId: true },
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

  const usersWithClienteIds = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleName: u.role?.name ?? null,
    clienteIds: u.clienteAssignments.map((va) => va.clienteId),
  }));

  return { types, statuses, clientes, users: usersWithClienteIds, schedules };
}

/**
 * Catalogs needed to fill the bulk-incident CSV.
 * Filters by user's Cliente access (admin sees all).
 */
export async function getBulkIncidentCatalogs() {
  const user = await requirePermission("incidents:create");
  const clienteFilter = getClienteWhereClause(user);

  const isNullFilter =
    clienteFilter.clienteId &&
    typeof clienteFilter.clienteId === "object" &&
    "equals" in clienteFilter.clienteId &&
    clienteFilter.clienteId.equals === null;
  // Schedules without any active Clientes are considered global and always shown.
  const scheduleWhere = isNullFilter
    ? {
        active: true,
        // User has no accessible Cliente: show only clienteless (global) schedules.
        clientes: { none: { active: true } },
      }
    : {
        active: true,
        ...(clienteFilter.clienteId &&
        typeof clienteFilter.clienteId === "string"
          ? {
              // Include schedules linked to this specific Cliente OR global schedules
              // (no active Cliente links) so that client-less schedules are always shown.
              OR: [
                {
                  clientes: {
                    some: { clienteId: clienteFilter.clienteId, active: true },
                  },
                },
                { clientes: { none: { active: true } } },
              ],
            }
          : {}),
      };

  const [types, statuses, clientes, schedules, fsrs] = await Promise.all([
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
    prisma.cliente.findMany({
      where: { active: true, ...clienteFilter },
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
        clientes: {
          where: { active: true },
          select: { clienteId: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true, role: { name: "FSR" } },
      select: {
        id: true,
        name: true,
        email: true,
        clienteAssignments: {
          where: { active: true },
          select: { clienteId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const fsrUsers = fsrs.map((f) => ({
    id: f.id,
    name: f.name,
    email: f.email,
    clienteIds: f.clienteAssignments.map((va) => va.clienteId),
  }));

  const schedulesWithClienteIds = schedules.map((s) => ({
    id: s.id,
    title: s.title,
    scheduledAt: s.scheduledAt,
    endDate: s.endDate,
    clienteIds: s.clientes.map((v) => v.clienteId),
  }));

  return {
    types,
    statuses,
    clientes,
    schedules: schedulesWithClienteIds,
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
  startedAt: string | null;
  resolvedAt: string | null;
  clienteId: string | null;
  clienteCodeRaw: string | null;
  clienteResolved: boolean;
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
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/") // normalize spacing around "/"
    .replace(/\s+/g, " ") // collapse repeated whitespace
    .trim();
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
 * Accepts either the legible "template" format (Spanish headers, cliente code, type name)
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
  // of the schedule's Clientes.
  if (scheduleId) {
    const sched = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
      select: {
        id: true,
        clientes: {
          where: { active: true },
          select: { clienteId: true },
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
    const accessible = sched.clientes.some((v) =>
      canAccessCliente(user, v.clienteId),
    );
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
  const [allTypes, allClientes, allFsrs] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
    prisma.cliente.findMany({
      where: { active: true, ...getClienteWhereClause(user) },
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
  const clientesByCode = new Map(
    allClientes.map((v) => [normalizeForMatch(v.code), v.id] as const),
  );
  const clientesById = new Set(allClientes.map((v) => v.id));
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
      const tipoRaw = getStr("tipo");
      const fechaInicioRaw = getStr("fecha_inicio");
      const clienteRaw = getStr("cliente");

      // Skip rows that look completely empty (typical trailing rows in Excel).
      if (
        title === "" &&
        description === "" &&
        tipoRaw === "" &&
        fechaInicioRaw === "" &&
        clienteRaw === ""
      ) {
        return;
      }

      if (title.length < 3) {
        fieldErrors.titulo = "Título debe tener al menos 3 caracteres";
      }
      if (description.length < 1) {
        fieldErrors.descripcion = "Descripción es requerida";
      }

      let startedAt: Date | null = null;
      if (fechaInicioRaw) {
        const d = parseMxDateTime(fechaInicioRaw);
        if (!d) {
          fieldErrors.fecha_inicio = `Fecha inválida: "${fechaInicioRaw}"`;
        } else {
          startedAt = d;
        }
      }

      const clienteCodeRaw = clienteRaw || null;
      const clienteId = clienteCodeRaw
        ? (clientesByCode.get(normalizeForMatch(clienteCodeRaw)) ?? null)
        : null;
      if (clienteCodeRaw && !clienteId) {
        fieldErrors.cliente = `Cliente "${clienteCodeRaw}" no encontrado — selecciona uno`;
      }

      // tipo vacío es válido (fallback a "Desconocido"). Un tipo NO vacío que
      // no existe en el catálogo es un ERROR visible: la fila no se puede
      // guardar hasta que el usuario seleccione el tipo correcto en el preview.
      const typeNameRaw = tipoRaw || null;
      const typeId = typeNameRaw
        ? (typesByName.get(normalizeForMatch(typeNameRaw)) ?? null)
        : null;
      const typeResolved = !typeNameRaw || typeId !== null;
      if (typeNameRaw && !typeId) {
        fieldErrors.tipo = `Tipo "${typeNameRaw}" no existe en el catálogo — selecciónalo`;
      }

      resolved.push({
        rowNumber,
        title,
        description,
        startedAt: toIsoOrNull(startedAt),
        resolvedAt: null,
        clienteId,
        clienteCodeRaw,
        clienteResolved: clienteId !== null,
        typeId,
        typeNameRaw,
        typeResolved,
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
    const clienteId = data.clienteId ?? null;
    if (!clienteId) {
      errors.push({
        row: rowNumber,
        field: "clienteId",
        message: "clienteId requerido en snapshot",
      });
      rowOk = false;
    } else if (!clientesById.has(clienteId)) {
      errors.push({
        row: rowNumber,
        field: "clienteId",
        message: `Cliente ${clienteId} no existe o no accesible`,
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
        startedAt: toIsoOrNull(data.startedAt),
        resolvedAt: toIsoOrNull(data.resolvedAt),
        clienteId,
        clienteCodeRaw: null,
        clienteResolved: true,
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

  // Validate schedule + collect its Clientes for per-row cross-check.
  let scheduleClienteIds: Set<string> | null = null;
  if (scheduleId) {
    const sched = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
      select: {
        id: true,
        clientes: {
          where: { active: true },
          select: { clienteId: true },
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
    // A schedule without any active Clientes is considered global (no Cliente
    // restriction). Only check access when there is at least one Client linked.
    const hasClientes = sched.clientes.length > 0;
    const accessible =
      !hasClientes ||
      sched.clientes.some((v) => canAccessCliente(user, v.clienteId));
    if (!accessible) {
      return {
        ok: false,
        errors: [
          { row: 0, message: "Sin acceso a la programación seleccionada" },
        ],
      };
    }
    scheduleClienteIds = hasClientes
      ? new Set(sched.clientes.map((v) => v.clienteId))
      : null;
  }

  // Catalogs for re-validation.
  const clienteIds = [
    ...new Set(rows.map((r) => r.clienteId).filter((v): v is string => !!v)),
  ];
  const typeIds = [
    ...new Set(
      rows.map((r) => r.typeId).filter((v): v is number => v !== null),
    ),
  ];
  const assigneeIds = [...new Set(rows.flatMap((r) => r.assigneeIds))];

  const [clientesExisting, typesExisting, fsrsExisting] = await Promise.all([
    clienteIds.length
      ? prisma.cliente.findMany({
          where: { id: { in: clienteIds }, active: true },
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
  const validClientes = new Set(clientesExisting.map((v) => v.id));
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
    if (!row.clienteId) {
      errors.push({
        row: row.rowNumber,
        field: "clienteId",
        message: "Selecciona un Cliente para esta fila",
      });
    } else if (!validClientes.has(row.clienteId)) {
      errors.push({
        row: row.rowNumber,
        field: "clienteId",
        message: `Cliente ${row.clienteId} no existe o inactivo`,
      });
    } else if (!canAccessCliente(user, row.clienteId)) {
      errors.push({
        row: row.rowNumber,
        field: "clienteId",
        message: "Sin acceso al Cliente seleccionado",
      });
    } else if (scheduleClienteIds && !scheduleClienteIds.has(row.clienteId)) {
      errors.push({
        row: row.rowNumber,
        field: "clienteId",
        message:
          "El Cliente de esta fila no está incluido en los Clientes de la programación seleccionada",
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

  // Rows with pre-selected FSRs get a real Assignment after the transaction
  // commits (see ensureFsrsAssignedToIncident) — skipped for historical
  // resolvedAt/CERRADO rows, which shouldn't be reopened into ASIGNADO.
  const pendingAssignments: Array<{
    incidentId: number;
    assigneeIds: string[];
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const incident = await tx.incident.create({
        data: {
          title: row.title.trim(),
          description: row.description.trim(),
          typeId: row.typeId ?? fallbackTypeId,
          statusId: row.resolvedAt ? closedStatus.id : openStatus.id,
          clienteId: row.clienteId,
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
        if (!row.resolvedAt) {
          pendingAssignments.push({
            incidentId: incident.id,
            assigneeIds: row.assigneeIds,
          });
        }
      }
    }
  });

  if (pendingAssignments.length > 0) {
    const { ensureFsrsAssignedToIncident } = await import(
      "@/lib/actions/assignments"
    );
    for (const { incidentId, assigneeIds } of pendingAssignments) {
      await ensureFsrsAssignedToIncident(incidentId, assigneeIds, user.id);
    }
  }

  revalidatePath("/admin/incidents");
  revalidatePath("/client/incidents");
  return { ok: true, created: rows.length };
}

export type BulkAssignChanges = {
  /** undefined = no tocar; null = quitar la programación */
  scheduleId?: string | null;
  /** undefined = no tocar */
  clienteId?: string;
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
    changes.clienteId === undefined &&
    changes.fsrIds === undefined
  ) {
    return {
      ok: false,
      errors: [{ incidentId: 0, message: "Nada que modificar" }],
    };
  }

  const incidents = await prisma.incident.findMany({
    where: { id: { in: incidentIds }, active: true },
    select: { id: true, clienteId: true },
  });
  const found = new Set(incidents.map((i) => i.id));
  const errors: Array<{ incidentId: number; message: string }> = [];

  for (const id of incidentIds) {
    if (!found.has(id)) {
      errors.push({ incidentId: id, message: "Incidente no encontrado" });
    }
  }

  // Per-incident access check based on current Cliente.
  for (const inc of incidents) {
    if (!canAccessCliente(user, inc.clienteId)) {
      errors.push({
        incidentId: inc.id,
        message: "Sin acceso al Cliente actual del incidente",
      });
    }
  }

  // Validate target Cliente (single value, applies to all selected).
  if (changes.clienteId !== undefined) {
    const targetCliente = await prisma.cliente.findFirst({
      where: { id: changes.clienteId, active: true },
      select: { id: true },
    });
    if (!targetCliente) {
      return {
        ok: false,
        errors: [
          { incidentId: 0, message: `Cliente ${changes.clienteId} no existe` },
        ],
      };
    }
    if (!canAccessCliente(user, changes.clienteId)) {
      return {
        ok: false,
        errors: [{ incidentId: 0, message: "Sin acceso al Cliente destino" }],
      };
    }
  }

  // Validate target schedule and its Clientes.
  let scheduleClienteIds: Set<string> | null = null;
  if (changes.scheduleId !== undefined && changes.scheduleId !== null) {
    const sched = await prisma.schedule.findFirst({
      where: { id: changes.scheduleId, active: true },
      select: {
        id: true,
        clientes: { where: { active: true }, select: { clienteId: true } },
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
    // Global schedules (no active Clientes) impose no cliente restriction:
    // keep scheduleClienteIds null so the truthy guard below skips the check.
    scheduleClienteIds =
      sched.clientes.length > 0
        ? new Set(sched.clientes.map((v) => v.clienteId))
        : null;
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

  // Per-incident validation: schedule↔Cliente consistency.
  for (const inc of incidents) {
    const effectiveCliente = changes.clienteId ?? inc.clienteId;
    if (
      scheduleClienteIds &&
      effectiveCliente &&
      !scheduleClienteIds.has(effectiveCliente)
    ) {
      errors.push({
        incidentId: inc.id,
        message:
          "El Cliente del incidente no está incluido en la programación seleccionada",
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
    if (changes.clienteId !== undefined) {
      updateData.clienteId = changes.clienteId;
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
    const { ensureFsrsAssignedToIncident } = await import(
      "@/lib/actions/assignments"
    );
    const failures: Array<{ incidentId: number; message: string }> = [];
    for (const id of found) {
      try {
        let toAdd: string[];
        if (changes.fsrIds.mode === "replace") {
          ({ toAdd } = await syncIncidentAssignees(id, changes.fsrIds.ids));
        } else {
          const current = await prisma.incidentAssignee.findMany({
            where: { incidentId: id, active: true },
            select: { userId: true },
          });
          const merged = new Set([
            ...current.map((c) => c.userId),
            ...changes.fsrIds.ids,
          ]);
          ({ toAdd } = await syncIncidentAssignees(id, [...merged]));
        }
        // Give newly-enabled FSRs a real Assignment they can see (see
        // ensureFsrsAssignedToIncident) instead of eligibility-only + notification.
        if (toAdd.length > 0) {
          await ensureFsrsAssignedToIncident(id, toAdd, user.id);
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

  return guarded(async () => {
    const result = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({
        where: { id: incidentId },
        select: { id: true, status: { select: { name: true } } },
      });
      if (!incident) throw new Error("Incidencia no encontrada");

      const currentStatus = incident.status?.name;
      if (currentStatus === INCIDENT_STATE.CANCELADA) {
        businessRule("La incidencia ya está cancelada");
      }
      if (currentStatus === INCIDENT_STATE.CERRADO) {
        businessRule("No se puede cancelar una incidencia cerrada");
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

    return { data: result };
  });
}
