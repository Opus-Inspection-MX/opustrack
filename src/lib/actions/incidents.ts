"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { assertClienteAccessAsync } from "@/lib/auth/filters";
import {
  getReportScope,
  incidentScopeWhere,
  scheduleScopeWhere,
} from "@/lib/auth/report-scope";
import {
  includeRoles,
  roleNamesOf,
  whereHasRole,
} from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  resolveTypeIdOrFallback,
  syncIncidentAssignees,
} from "@/lib/incidents/shared";
import {
  notifyIncidentCreated,
  notifyIncidentUpdated,
} from "@/lib/notifications";
import { INCIDENT_STATE, syncIncidentState } from "@/lib/state-machine";
import { getPrimaryClienteId } from "@/lib/utils/cliente-assignments";
import {
  IncidentClientCreateSchema,
  type IncidentCreateInput,
  IncidentCreateSchema,
  IncidentUpdateSchema,
} from "@/lib/validations/incidents";
import { type ActionResult, businessRule, guarded, ok } from "./result";

// Keep legacy type for backward compatibility with existing forms
export type IncidentFormData = IncidentCreateInput;

// Row reconciliation lives in `lib/incidents/shared.ts` (shared with the
// bulk subsystem in `incidents-bulk.ts`).

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
  const scope = await getReportScope(user);
  const clienteFilter = incidentScopeWhere(scope);

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
        cliente: { include: { state: true } },
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
      cliente: { include: { state: true } },
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
      cliente: { include: { state: true } },
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          ...includeRoles,
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
  await assertClienteAccessAsync(user, incident.clienteId);

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
        reporterName: validated.reporterName?.trim() || null,
        startedAt: validated.startedAt ?? null,
        resolvedAt: null,
      },
      include: {
        type: true,
        status: true,
        cliente: { include: { state: true } },
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
        "@/lib/assignments/ensure-fsrs"
      );
      await ensureFsrsAssignedToIncident(incident.id, validated.assigneeIds);
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
        // Who actually raised it: the account belongs to the whole center.
        reporterName: validated.reporterName?.trim() || null,
        lineId: validated.lineId || null,
        equipmentId: validated.equipmentId || null,
      },
      include: {
        type: true,
        status: true,
        cliente: { include: { state: true } },
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
      cliente: { include: { state: true } },
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
export async function updateIncident(id: number, data: IncidentFormData) {
  const user = await requirePermission("incidents:update");

  return guarded(async () => {
    // The action takes `id` separately, so the schema's `id` is omitted.
    IncidentUpdateSchema.omit({ id: true }).parse(data);
    // Verify access before update
    const existing = await prisma.incident.findUnique({
      where: { id },
      select: { clienteId: true },
    });

    if (!existing) {
      throw new Error("Incident not found");
    }

    await assertClienteAccessAsync(user, existing.clienteId);

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
        // `undefined` leaves it alone, so an update that omits the field does
        // not wipe a name someone already typed.
        reporterName:
          data.reporterName === undefined
            ? undefined
            : data.reporterName?.trim() || null,
      },
      include: {
        type: true,
        status: true,
        cliente: { include: { state: true } },
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
        "@/lib/assignments/ensure-fsrs"
      );
      await ensureFsrsAssignedToIncident(id, toAdd);
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
    await assertClienteAccessAsync(user, incident.clienteId);

    // Validate every FSR exists, is an FSR, and is accessible.
    if (fsrIds.length) {
      const fsrs = await prisma.user.findMany({
        where: {
          id: { in: fsrIds },
          active: true,
          ...whereHasRole("FSR"),
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
        "@/lib/assignments/ensure-fsrs"
      );
      await ensureFsrsAssignedToIncident(incidentId, toAdd);
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
    await assertClienteAccessAsync(user, incident.clienteId);

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
    await assertClienteAccessAsync(user, incident.clienteId);

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

    await assertClienteAccessAsync(user, incident.clienteId);

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
  await assertClienteAccessAsync(user, incident.clienteId);

  const result = await syncIncidentState(id);

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${id}`);
  revalidatePath("/fsr/incidents");
  revalidatePath("/client/incidents");
  return ok({ before: result.before, after: result.after });
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
    await assertClienteAccessAsync(user, incident.clienteId);

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
    where: { active: true, ...whereHasRole("FSR") },
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

/**
 * Get form options for incidents
 * Clientes and schedules filtered by user's Cliente (except ADMINISTRADOR)
 */
export async function getIncidentFormOptions() {
  const user = await requirePermission("incidents:read");
  const scope = await getReportScope(user);

  // Schedules linked to the caller's Clientes, plus global ones (no active
  // Cliente links) which are always shown. A fail-closed scope (no Clientes)
  // matches nothing.
  const scheduleWhere: Prisma.ScheduleWhereInput = {
    active: true,
    ...scheduleScopeWhere(scope),
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
        ...(scope.clienteIds === null ? {} : { id: { in: scope.clienteIds } }),
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        ...includeRoles,
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

  // `roleNames` is plural now: the picker highlights FSRs, and a user can be
  // an FSR *and* an administrator at the same time.
  const usersWithClienteIds = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roleNames: roleNamesOf(u),
    clienteIds: u.clienteAssignments.map((va) => va.clienteId),
  }));

  return { types, statuses, clientes, users: usersWithClienteIds, schedules };
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
          // Cancelled is not resolved: `resolvedAt` stays null so resolution
          // metrics (trend, summary) never count a cancellation as a fix.
          resolvedAt: null,
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
