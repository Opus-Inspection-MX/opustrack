"use server";

import type { Prisma } from "@prisma/client";
import { IncidentEventType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureFsrsAssignedToIncident } from "@/lib/assignments/ensure-fsrs";
import { assertIncidentEditable } from "@/lib/assignments/incident-mutable";
import { assertBelongsToClient, requireClientAccess } from "@/lib/auth/access";
import { requirePermission } from "@/lib/auth/auth";
import { assertClientAccessAsync } from "@/lib/auth/filters";
import {
  getReportScope,
  incidentScopeWhere,
  scheduleScopeWhere,
} from "@/lib/auth/report-scope";
import { SCOPE_ALL_CLIENTS, userHasPermission } from "@/lib/authz/authz";
import { ROLE } from "@/lib/authz/roles";
import {
  includeRoles,
  roleCodesOf,
  roleNamesOf,
  whereHasRole,
} from "@/lib/authz/user-queries";
import { FALLBACK_INCIDENT_TYPE_NAME } from "@/lib/constants/incident-type";
import { codeOf } from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  notifyIncidentCancelled,
  notifyIncidentCreated,
  notifyIncidentUpdated,
  transactionWithNotifications,
} from "@/lib/notifications";
import { INCIDENT_STATE } from "@/lib/state-machine";
import { logIncidentEvent } from "@/lib/state-machine/incident-events";
import { getPrimaryClientId } from "@/lib/utils/client-assignments";
import { intIdSchema } from "@/lib/validations/common";
import {
  type IncidentCreateInput,
  IncidentCreateSchema,
  IncidentReporterCreateSchema,
  IncidentUpdateSchema,
} from "@/lib/validations/incidents";
import { type ActionResult, businessRule, guarded } from "./result";

// Keep legacy type for backward compatibility with existing forms
export type IncidentFormData = IncidentCreateInput;

async function resolveIncidentType(
  tx: Prisma.TransactionClient,
  typeId?: number | null,
) {
  const type = await tx.incidentType.findUnique({
    where: typeId
      ? { id: typeId, active: true }
      : { name: FALLBACK_INCIDENT_TYPE_NAME, active: true },
    select: { id: true },
  });
  if (!type) businessRule("Tipo de incidente no válido.");
  return type.id;
}

async function createIncidentRecord(
  tx: Prisma.TransactionClient,
  data: Prisma.IncidentUncheckedCreateInput,
  actorId: string,
  source: "single" | "client",
  assigneeIds: string[] = [],
) {
  const incident = await tx.incident.create({
    data,
    include: {
      type: true,
      status: true,
      client: { include: { state: true } },
      reportedBy: { select: { id: true, name: true, email: true } },
    },
  });
  await logIncidentEvent(tx, {
    incidentId: incident.id,
    eventType: IncidentEventType.CREATED,
    actorId,
    toStatus: INCIDENT_STATE.ABIERTO,
    payload:
      source === "client"
        ? { source }
        : { source, assigneeIds: [...new Set(assigneeIds)] },
  });
  if (assigneeIds.length) {
    await tx.incidentAssignee.createMany({
      data: [...new Set(assigneeIds)].map((userId) => ({
        incidentId: incident.id,
        userId,
      })),
      skipDuplicates: true,
    });
    await ensureFsrsAssignedToIncident(incident.id, assigneeIds, tx);
  }
  return incident;
}

async function reconcileIncidentFsrs(
  tx: Prisma.TransactionClient,
  incidentId: number,
  ids: string[],
  actorId: string,
) {
  const desired = [...new Set(ids)];
  const fsrs = await tx.user.findMany({
    where: { id: { in: desired }, active: true, ...whereHasRole(ROLE.FSR) },
    select: { id: true },
  });
  if (fsrs.length !== desired.length)
    businessRule("Uno o más FSR no existen o no tienen rol FSR");
  const current = await tx.incidentAssignee.findMany({
    where: { incidentId, active: true },
    select: { userId: true },
  });
  const active = new Set(current.map((r) => r.userId));
  const toAdd = desired.filter((id) => !active.has(id));
  const toRemove = [...active].filter((id) => !desired.includes(id));
  if (toRemove.length) {
    const inUse = await tx.assignmentAssignee.findMany({
      where: {
        userId: { in: toRemove },
        active: true,
        assignment: { incidentId, active: true },
      },
      select: { userId: true },
    });
    if (inUse.length)
      businessRule(
        "No se puede retirar a FSR(s) asignado(s) a una asignación activa.",
      );
    await tx.incidentAssignee.updateMany({
      where: { incidentId, userId: { in: toRemove }, active: true },
      data: { active: false },
    });
  }
  for (const userId of toAdd) {
    await tx.incidentAssignee.upsert({
      where: { incidentId_userId: { incidentId, userId } },
      create: { incidentId, userId },
      update: { active: true },
    });
  }
  for (const userId of [...toAdd, ...toRemove]) {
    await logIncidentEvent(tx, {
      incidentId,
      actorId,
      eventType: toAdd.includes(userId)
        ? IncidentEventType.ASSIGNEE_ADDED
        : IncidentEventType.ASSIGNEE_REMOVED,
      payload: { userId },
    });
  }
  if (toAdd.length) await ensureFsrsAssignedToIncident(incidentId, toAdd, tx);
  return { toAdd };
}

// Row reconciliation lives in `lib/incidents/shared.ts` (shared with the
// bulk subsystem in `incidents-bulk.ts`).

type GetIncidentsParams = {
  page?: number;
  limit?: number;
  search?: string;
};

/**
 * Paginated audit-trail read for one incident (RF-219).
 * Admin-only surface: chronological events with resolved actor names.
 * Fail closed — no Client assignment or no access means no rows.
 */
const INCIDENT_EVENTS_PAGE_SIZE = 50;

function eventPayloadUserId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["userId", "deniedUserId"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export async function getIncidentEvents(incidentId: number, page = 1) {
  const user = await requirePermission("incidents:read");

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { clientId: true },
  });
  if (!incident) {
    throw new Error("Incident not found");
  }
  await assertClientAccessAsync(user, incident.clientId);

  const safePage = Math.max(1, Math.floor(page) || 1);
  const [events, total] = await Promise.all([
    prisma.incidentEvent.findMany({
      where: { incidentId },
      orderBy: { createdAt: "asc" },
      skip: (safePage - 1) * INCIDENT_EVENTS_PAGE_SIZE,
      take: INCIDENT_EVENTS_PAGE_SIZE,
    }),
    prisma.incidentEvent.count({ where: { incidentId } }),
  ]);

  const userIds = new Set<string>();
  for (const event of events) {
    if (event.actorId) userIds.add(event.actorId);
    const mentioned = eventPayloadUserId(event.payload);
    if (mentioned) userIds.add(mentioned);
  }
  const users =
    userIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true },
        })
      : [];
  const names = new Map(users.map((u) => [u.id, u.name] as const));

  return {
    events: events.map((event) => ({
      ...event,
      actorName: event.actorId ? (names.get(event.actorId) ?? null) : null,
    })),
    userNames: Object.fromEntries(names),
    pagination: {
      total,
      page: safePage,
      pageSize: INCIDENT_EVENTS_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / INCIDENT_EVENTS_PAGE_SIZE)),
    },
  };
}

/**
 * Get incidents with relations, paginated and searchable (title, description).
 * Filtered by user's Client (except ADMINISTRADOR who sees all).
 */
export async function getIncidents(params?: GetIncidentsParams) {
  const user = await requirePermission("incidents:read");
  const scope = await getReportScope(user);
  const clientFilter = incidentScopeWhere(scope);

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const skip = (page - 1) * limit;
  const search = params?.search?.trim();

  const where: Prisma.IncidentWhereInput = {
    active: true,
    ...clientFilter, // Apply Client filter
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
        client: { include: { state: true } },
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
      client: { include: { state: true } },
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
 * Verifies user has access to the incident's Client
 */
export async function getIncidentById(id: number) {
  const user = await requirePermission("incidents:read");

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      type: true,
      status: true,
      client: { include: { state: true } },
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          ...includeRoles,
        },
      },
      schedule: true,
      attachments: {
        where: { active: true },
        orderBy: { uploadedAt: "desc" },
      },
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

  // Verify user has access to this incident's Client
  await assertClientAccessAsync(user, incident.clientId);

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
    const validated = IncidentCreateSchema.extend({
      lineId: intIdSchema.nullable().optional(),
      equipmentId: intIdSchema.nullable().optional(),
    }).parse(data);

    // Tenant gate (H-04): the Client must be in scope — filing under another
    // Client is the write-side of the same leak the reads close. A null
    // Client is admin-only (fail closed, H-05).
    const incident = await transactionWithNotifications(async (tx) => {
      const targetClientId = validated.clientId || null;
      await requireClientAccess(user, targetClientId, tx);
      await assertBelongsToClient(
        {
          scheduleId: validated.scheduleId ?? null,
          lineId: validated.lineId ?? null,
          equipmentId: validated.equipmentId ?? null,
        },
        targetClientId,
        tx,
      );

      // State machine: every new incident starts at ABIERTO. Any caller-provided
      // statusId is ignored so the flow can't be skipped.
      const initialStatus = await tx.incidentStatus.findUnique({
        where: { code: INCIDENT_STATE.ABIERTO },
        select: { id: true },
      });
      if (!initialStatus) {
        throw new Error(
          `IncidentStatus '${INCIDENT_STATE.ABIERTO}' no existe en el catálogo`,
        );
      }

      const typeId = await resolveIncidentType(tx, validated.typeId);

      // The reporter is whoever files it, unless the caller can see every
      // Client (H-04): a scoped caller passing someone else's id would file
      // incidents under another person's name.
      const reportedById =
        validated.reportedById && userHasPermission(user, SCOPE_ALL_CLIENTS)
          ? validated.reportedById
          : user.id;

      return createIncidentRecord(
        tx,
        {
          title: validated.title,
          description: validated.description,
          typeId,
          statusId: initialStatus.id,
          clientId: targetClientId,
          scheduleId: validated.scheduleId || null,
          lineId: validated.lineId ?? null,
          equipmentId: validated.equipmentId ?? null,
          reportedById,
          reporterName: validated.reporterName?.trim() || null,
          startedAt: validated.startedAt ?? null,
          resolvedAt: null,
        },
        user.id,
        "single",
        validated.assigneeIds,
      );
    });

    // POST-tx: notify admins of new incident (RF-465). Never throws.
    await notifyIncidentCreated(
      incident.id,
      incident.title,
      user.id,
      incident.clientId,
    );

    revalidatePath("/admin/incidents");
    revalidatePath("/reporter/incidents");
    return { data: incident };
  });
}

/**
 * Create incident as reporter (simplified for reporter role)
 * Validates input with Zod schema
 */
export async function createIncidentAsReporter(data: unknown) {
  const user = await requirePermission("incidents:create");

  return guarded(async () => {
    // Validate input
    const validated = IncidentReporterCreateSchema.parse(data);
    const incident = await transactionWithNotifications(async (tx) => {
      // Get initial status: new incidents start at ABIERTO (stable code).
      const initialStatus = await tx.incidentStatus.findFirst({
        where: { code: INCIDENT_STATE.ABIERTO },
      });

      if (!initialStatus) {
        throw new Error(`Estado ${INCIDENT_STATE.ABIERTO} no encontrado`);
      }

      // Reporter must have a Client assigned
      const primary = await tx.userClientAssignment.findFirst({
        where: { userId: user.id, isPrimary: true, active: true },
        select: { clientId: true },
      });
      const userClientId = primary?.clientId;
      if (!userClientId) {
        businessRule("El usuario no tiene un Cliente asignado");
      }

      // Cross-references arrive from the client: the line and equipment must
      // belong to the reporter's own Client (H-04).
      await assertBelongsToClient(
        {
          lineId: validated.lineId ?? null,
          equipmentId: validated.equipmentId ?? null,
        },
        userClientId,
        tx,
      );

      const typeId = await resolveIncidentType(tx, validated.typeId);

      return createIncidentRecord(
        tx,
        {
          title: validated.title,
          description: validated.description,
          typeId,
          statusId: initialStatus.id,
          clientId: userClientId,
          reportedById: user.id,
          // Who actually raised it: the account belongs to the whole center.
          reporterName: validated.reporterName?.trim() || null,
          lineId: validated.lineId || null,
          equipmentId: validated.equipmentId || null,
        },
        user.id,
        "client",
      );
    });

    // POST-tx: notify admins of new incident (RF-465). Never throws.
    await notifyIncidentCreated(
      incident.id,
      incident.title,
      user.id,
      incident.clientId,
    );

    revalidatePath("/reporter/incidents");
    revalidatePath("/admin/incidents");
    return { data: incident };
  });
}

/**
 * Get incidents for reporter (only their Client)
 */
export async function getReporterIncidents() {
  const user = await requirePermission("incidents:read");

  const userClientId = await getPrimaryClientId(user.id);
  if (!userClientId) {
    return [];
  }

  // Reporter users should only see incidents they reported themselves
  const incidents = await prisma.incident.findMany({
    where: {
      reportedById: user.id, // Filter by the user who reported it
      clientId: userClientId, // Also ensure it's from their Client
      active: true,
    },
    include: {
      type: true,
      status: true,
      client: { include: { state: true } },
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
 * Verifies user has access to the incident's Client before updating
 */
export async function updateIncident(id: number, data: IncidentFormData) {
  const user = await requirePermission("incidents:update");

  return guarded(async () => {
    // The action takes `id` separately, so the schema's `id` is omitted.
    IncidentUpdateSchema.omit({ id: true }).parse(data);
    // Verify access before update
    const incident = await transactionWithNotifications(async (tx) => {
      const existing = await tx.incident.findUnique({
        where: { id, active: true },
        select: { clientId: true },
      });

      if (!existing) {
        throw new Error("Incident not found");
      }

      await requireClientAccess(user, existing.clientId, tx);
      await assertIncidentEditable(tx, id);

      // The new Client needs the same proof (H-04): checking only the current
      // one lets anyone move an incident to another Client.
      await requireClientAccess(user, data.clientId || null, tx);
      await assertBelongsToClient(
        { scheduleId: data.scheduleId || null },
        data.clientId || null,
        tx,
      );

      // typeId NOT NULL en BD. Si el caller intenta poner null/undefined, fallback.
      const typeId = await resolveIncidentType(tx, data.typeId);

      // State machine owns statusId/resolvedAt — ignore any caller-provided values.
      const incident = await tx.incident.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          typeId,
          clientId: data.clientId || null,
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
          client: { include: { state: true } },
          // H-01: same as createIncident — the reporter card, not the hash.
          reportedBy: { select: { id: true, name: true, email: true } },
        },
      });
      let toAdd: string[] = [];
      if (data.assigneeIds !== undefined) {
        ({ toAdd } = await reconcileIncidentFsrs(
          tx,
          id,
          data.assigneeIds,
          user.id,
        ));
      }
      return { incident, toAdd };
    });

    // POST-tx: notify incident FSR events (RF-466, RF-468). Both never-throw.
    // Fetch existing active IncidentAssignees (excluding newly added) for INCIDENT_UPDATED.
    const existingFsrRows = await prisma.incidentAssignee.findMany({
      where: {
        incidentId: id,
        active: true,
        userId: { notIn: incident.toAdd },
      },
      select: { userId: true },
    });
    const existingFsrIds = existingFsrRows.map((r) => r.userId);
    if (existingFsrIds.length > 0) {
      await notifyIncidentUpdated(
        id,
        incident.incident.title,
        existingFsrIds,
        user.id,
      );
    }

    revalidatePath("/admin/incidents");
    revalidatePath(`/admin/incidents/${id}`);
    revalidatePath("/admin/programacion");
    return { data: incident.incident };
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
    await transactionWithNotifications(async (tx) => {
      const incident = await tx.incident.findUnique({
        where: { id: incidentId, active: true },
        select: { clientId: true, title: true },
      });
      if (!incident) {
        throw new Error("Incidente no encontrado");
      }
      await requireClientAccess(user, incident.clientId, tx);
      await assertIncidentEditable(tx, incidentId);

      // Validate every FSR exists, is an FSR, and is accessible.
      if (fsrIds.length) {
        const fsrs = await tx.user.findMany({
          where: {
            id: { in: fsrIds },
            active: true,
            ...whereHasRole(ROLE.FSR),
          },
          select: { id: true },
        });
        if (fsrs.length !== new Set(fsrIds).size) {
          businessRule("Uno o más FSR no existen o no tienen rol FSR");
        }
      }

      await reconcileIncidentFsrs(tx, incidentId, fsrIds, user.id);
    });

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

    await transactionWithNotifications(async (tx) => {
      const incident = await tx.incident.findUnique({
        where: { id: incidentId, active: true },
        select: {
          clientId: true,
          scheduleId: true,
          title: true,
          description: true,
        },
      });
      if (!incident) {
        throw new Error("Incidente no encontrado");
      }
      await requireClientAccess(user, incident.clientId, tx);
      await assertIncidentEditable(tx, incidentId);

      if (incident.scheduleId) {
        await requirePermission("schedules:update");
        const schedule = await tx.schedule.findUnique({
          where: { id: incident.scheduleId, active: true },
          select: {
            clients: { where: { active: true }, select: { clientId: true } },
            incidents: { where: { active: true }, select: { clientId: true } },
          },
        });
        if (!schedule) businessRule("No encontrado.");
        for (const clientId of new Set([
          ...schedule.clients.map((c) => c.clientId),
          ...schedule.incidents.map((i) => i.clientId),
        ])) {
          await requireClientAccess(user, clientId, tx);
        }
        await tx.schedule.update({
          where: { id: incident.scheduleId },
          data: { scheduledAt },
        });
      } else {
        await requirePermission("schedules:create");
        const schedule = await tx.schedule.create({
          data: {
            title: incident.title,
            description: incident.description,
            scheduledAt,
            ...(incident.clientId && {
              clients: { create: { clientId: incident.clientId } },
            }),
          },
        });
        await tx.incident.update({
          where: { id: incidentId },
          data: { scheduleId: schedule.id },
        });
      }
    });

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
    await transactionWithNotifications(async (tx) => {
      const incident = await tx.incident.findUnique({
        where: { id: incidentId, active: true },
        select: { clientId: true },
      });
      if (!incident) {
        throw new Error("Incidente no encontrado");
      }
      await requireClientAccess(user, incident.clientId, tx);
      await assertIncidentEditable(tx, incidentId);

      const type = await tx.incidentType.findFirst({
        where: { id: typeId, active: true },
        select: { id: true },
      });
      if (!type) {
        businessRule("Tipo de incidente no válido");
      }

      await tx.incident.update({
        where: { id: incidentId },
        data: { typeId },
      });
    });

    revalidatePath("/admin/programacion");
    revalidatePath("/admin/incidents");
    revalidatePath(`/admin/incidents/${incidentId}`);
    return {};
  });
}

/**
 * Delete incident (soft delete)
 * Verifies user has access to the incident's Client before deleting
 * Uses transaction to ensure atomicity when checking for active children
 */
export async function deleteIncident(id: number) {
  const user = await requirePermission("incidents:delete");

  return guarded(async () => {
    await transactionWithNotifications(async (tx) => {
      const incident = await tx.incident.findUnique({
        where: { id, active: true },
        select: { clientId: true },
      });

      if (!incident) {
        throw new Error("Incident not found");
      }

      await requireClientAccess(user, incident.clientId, tx);
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
 * Get FSR users for assignment
 * Filtered by user's Client (except ADMINISTRADOR who sees all FSRs)
 */
/**
 * FSRs list with their Client assignments, used by bulk/quick edit dialogs.
 * Requires `incidents:update` since the caller will modify IncidentAssignee.
 */
export async function getFsrsForAssignment() {
  await requirePermission("incidents:update");
  const fsrs = await prisma.user.findMany({
    where: { active: true, ...whereHasRole(ROLE.FSR) },
    select: {
      id: true,
      name: true,
      email: true,
      clientAssignments: {
        where: { active: true },
        select: { clientId: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return fsrs.map((f) => ({
    id: f.id,
    name: f.name,
    email: f.email,
    clientIds: f.clientAssignments.map((va) => va.clientId),
  }));
}

/**
 * Get form options for incidents
 * Clients and schedules filtered by user's Client (except ADMINISTRADOR)
 */
export async function getIncidentFormOptions() {
  const user = await requirePermission("incidents:read");
  const scope = await getReportScope(user);

  // Schedules linked to the caller's Clients, plus global ones (no active
  // Client links) which are always shown. A fail-closed scope (no Clients)
  // matches nothing.
  const scheduleWhere: Prisma.ScheduleWhereInput = {
    active: true,
    ...scheduleScopeWhere(scope),
  };

  const [types, statuses, clients, users, schedules] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.incidentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: {
        active: true,
        ...(scope.clientIds === null ? {} : { id: { in: scope.clientIds } }),
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
        clientAssignments: {
          where: { active: true },
          select: { clientId: true },
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

  // `roleCodes` is plural now: the picker highlights FSRs by stable code, and
  // a user can be an FSR *and* an administrator at the same time.
  // `roleNames` stays for display until the UI drops it.
  const usersWithClienteIds = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roleNames: roleNamesOf(u),
    roleCodes: roleCodesOf(u),
    clientIds: u.clientAssignments.map((va) => va.clientId),
  }));

  return { types, statuses, clients, users: usersWithClienteIds, schedules };
}

/**
 * Cancel an incident. Admin-only terminal action that does not require ODT.
 * Sets statusId to CANCELADA and records cancelledAt + cancellationReason.
 * Once cancelled, all child assignment mutations are blocked.
 */
export async function cancelIncident(incidentId: number, reason?: string) {
  const user = await requirePermission("incidents:cancel");

  return guarded(async () => {
    const result = await transactionWithNotifications(async (tx) => {
      const incident = await tx.incident.findUnique({
        where: { id: incidentId, active: true },
        select: {
          id: true,
          clientId: true,
          status: { select: { code: true, name: true } },
          resolvedAt: true,
        },
      });
      if (!incident) throw new Error("Incidencia no encontrada");
      await requireClientAccess(user, incident.clientId, tx);

      // Stable code (H-08): a renamed label must not bypass the guards.
      const currentStatus = codeOf(incident.status);
      if (currentStatus === INCIDENT_STATE.CANCELADA) {
        businessRule("La incidencia ya está cancelada");
      }
      if (currentStatus === INCIDENT_STATE.CERRADO) {
        businessRule("No se puede cancelar una incidencia cerrada");
      }

      const cancelledStatus = await tx.incidentStatus.findUnique({
        where: { code: INCIDENT_STATE.CANCELADA },
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

      // RF-219: the cancellation joins the same transaction as the mutation,
      // so a rolled-back cancel leaves no orphan event behind.
      await logIncidentEvent(tx, {
        incidentId,
        eventType: IncidentEventType.CANCELLED,
        actorId: user.id,
        fromStatus: currentStatus ?? null,
        toStatus: INCIDENT_STATE.CANCELADA,
        payload: { reason: trimmedReason, fromStatus: currentStatus },
      });

      return updated;
    });

    revalidatePath("/admin/incidents");
    revalidatePath(`/admin/incidents/${incidentId}`);
    revalidatePath("/admin/assignments");
    revalidatePath("/fsr/assignments");
    revalidatePath("/fsr/incidents");
    revalidatePath(`/fsr/incidents/${incidentId}`);
    revalidatePath("/reporter");
    revalidatePath(`/reporter/incidents/${incidentId}`);

    // POST-tx (commit-gated by position): the cancellation is terminal and
    // set directly, so it never flows through the sync collector.
    await notifyIncidentCancelled(
      incidentId,
      {
        title: result.title,
        reporterId: result.reportedById,
        clientId: result.clientId,
      },
      user.id,
    );

    return { data: result };
  });
}
