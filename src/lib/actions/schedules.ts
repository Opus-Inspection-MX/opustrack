"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getClientAccessScope, requireClientAccess } from "@/lib/auth/access";
import { requirePermission } from "@/lib/auth/auth";
import {
  getReportScope,
  incidentScopeWhere,
  scheduleScopeWhere,
} from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";
import { transactionWithNotifications } from "@/lib/notifications";
import {
  ScheduleCreateSchema,
  ScheduleQuickUpdateSchema,
  ScheduleUpdateSchema,
} from "@/lib/validations/schedules";
import { businessRule, guarded, rejected } from "./result";

export type ScheduleFormData = {
  title: string;
  description?: string;
  scheduledAt: Date;
  endDate?: Date | null;
  statusId?: number | null;
  clientIds: string[];
};

export type ScheduleQuickUpdateData = {
  clientIds: string[];
  scheduledAt: Date;
  endDate?: Date | null;
};

const scheduleInclude = {
  clients: {
    where: { active: true },
    include: {
      client: { select: { id: true, code: true, name: true } },
    },
  },
  _count: { select: { incidents: true } },
} satisfies Prisma.ScheduleInclude;

/**
 * Build a Prisma where filter that returns schedules whose [scheduledAt, endDate]
 * overlaps the [from, to] window. Schedules without endDate are treated as
 * point-in-time on scheduledAt.
 */
function overlapWhere(from?: Date, to?: Date): Prisma.ScheduleWhereInput {
  if (!from && !to) return {};
  const conditions: Prisma.ScheduleWhereInput[] = [];
  if (to) conditions.push({ scheduledAt: { lte: to } });
  if (from) {
    conditions.push({
      OR: [
        { endDate: { gte: from } },
        { endDate: null, scheduledAt: { gte: from } },
      ],
    });
  }
  return { AND: conditions };
}

/**
 * Get all schedules with pagination, search, and filters.
 * `activeFrom`/`activeTo` filter by overlap with [scheduledAt, endDate].
 */
export async function getSchedules(params?: {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: string;
  statusId?: number;
  activeFrom?: Date;
  activeTo?: Date;
}) {
  const user = await requirePermission("schedules:read");
  const scope = await getReportScope(user);

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  // The scope is one AND branch beside the filters (never merged into an
  // OR): a scoped user sees their linked schedules plus global ones, and an
  // empty scope matches nothing — not even globals.
  const overlap = overlapWhere(params?.activeFrom, params?.activeTo);
  const overlapClauses = overlap.AND
    ? Array.isArray(overlap.AND)
      ? overlap.AND
      : [overlap.AND]
    : [];
  const clauses: Prisma.ScheduleWhereInput[] = [
    scheduleScopeWhere(scope),
    ...overlapClauses,
  ];
  if (params?.search) {
    clauses.push({
      OR: [
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ],
    });
  }
  if (params?.clientId) {
    clauses.push({
      clients: { some: { clientId: params.clientId, active: true } },
    });
  }
  if (params?.statusId) {
    clauses.push({ statusId: params.statusId });
  }
  const where: Prisma.ScheduleWhereInput = {
    active: true,
    AND: clauses,
  };

  const total = await prisma.schedule.count({ where });

  const schedules = await prisma.schedule.findMany({
    where,
    include: scheduleInclude,
    orderBy: { scheduledAt: "desc" },
    skip,
    take: limit,
  });

  return {
    data: schedules,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get single schedule by ID
 */
export async function getScheduleById(id: string) {
  const user = await requirePermission("schedules:read");
  const scope = await getReportScope(user);

  const schedule = await prisma.schedule.findUnique({
    where: { id, active: true, AND: [scheduleScopeWhere(scope)] },
    include: {
      clients: {
        where: { active: true },
        include: {
          client: { select: { id: true, code: true, name: true } },
        },
      },
      incidents: {
        where: { active: true, ...incidentScopeWhere(scope) },
        include: {
          type: true,
          status: true,
          reportedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { reportedAt: "desc" },
      },
    },
  });

  return schedule;
}

async function assertAllClienteAccess(
  user: Awaited<ReturnType<typeof requirePermission>>,
  clientIds: string[],
  tx: Prisma.TransactionClient,
) {
  for (const v of clientIds) {
    await requireClientAccess(user, v, tx);
  }
}

async function assertActiveClients(
  tx: Prisma.TransactionClient,
  clientIds: string[],
) {
  if (!clientIds.length) return;
  const clients = await tx.client.findMany({
    where: { id: { in: clientIds }, active: true },
    select: { id: true },
  });
  if (clients.length !== clientIds.length)
    businessRule("Uno o más Clientes no existen o están inactivos.");
}

async function loadScheduleForMutation(
  tx: Prisma.TransactionClient,
  user: Awaited<ReturnType<typeof requirePermission>>,
  id: string,
  desiredClientIds?: string[],
) {
  const scope = await getClientAccessScope(user, tx);
  const schedule = await tx.schedule.findUnique({
    where: { id, active: true, AND: [scheduleScopeWhere(scope)] },
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
  if (
    desiredClientIds?.length &&
    schedule.incidents.some(
      (i) => i.clientId === null || !desiredClientIds.includes(i.clientId),
    )
  ) {
    businessRule(
      "La programación debe incluir a los Clientes de sus incidentes activos.",
    );
  }
  return schedule;
}

/**
 * Create new schedule
 */
export async function createSchedule(data: ScheduleFormData) {
  const user = await requirePermission("schedules:create");

  return guarded(async () => {
    ScheduleCreateSchema.parse(data);
    const clientIds = [...new Set(data.clientIds)];
    const schedule = await transactionWithNotifications(async (tx) => {
      await assertAllClienteAccess(user, clientIds, tx);
      await assertActiveClients(tx, clientIds);
      const created = await tx.schedule.create({
        data: {
          title: data.title,
          description: data.description || null,
          scheduledAt: data.scheduledAt,
          endDate: data.endDate || null,
          statusId: data.statusId ?? null,
        },
      });
      await tx.scheduleClient.createMany({
        data: clientIds.map((clientId) => ({
          scheduleId: created.id,
          clientId,
        })),
        skipDuplicates: true,
      });
      return tx.schedule.findUnique({
        where: { id: created.id },
        include: scheduleInclude,
      });
    });

    revalidatePath("/admin/schedules");
    revalidatePath("/admin/programacion");
    return { data: schedule };
  });
}

async function syncScheduleClients(
  tx: Prisma.TransactionClient,
  scheduleId: string,
  clientIds: string[],
) {
  const current = await tx.scheduleClient.findMany({
    where: { scheduleId },
    select: { clientId: true, active: true },
  });
  const desired = new Set(clientIds);
  const currentActive = new Set(
    current.filter((c) => c.active).map((c) => c.clientId),
  );
  const currentInactive = new Set(
    current.filter((c) => !c.active).map((c) => c.clientId),
  );

  const toDeactivate = [...currentActive].filter((v) => !desired.has(v));
  const toActivate = [...desired].filter((v) => currentInactive.has(v));
  const toCreate = [...desired].filter(
    (v) => !currentActive.has(v) && !currentInactive.has(v),
  );

  if (toDeactivate.length) {
    await tx.scheduleClient.updateMany({
      where: { scheduleId, clientId: { in: toDeactivate } },
      data: { active: false },
    });
  }
  if (toActivate.length) {
    await tx.scheduleClient.updateMany({
      where: { scheduleId, clientId: { in: toActivate } },
      data: { active: true },
    });
  }
  if (toCreate.length) {
    await tx.scheduleClient.createMany({
      data: toCreate.map((clientId) => ({ scheduleId, clientId })),
      skipDuplicates: true,
    });
  }
}

/**
 * Update existing schedule
 */
export async function updateSchedule(id: string, data: ScheduleFormData) {
  const user = await requirePermission("schedules:update");

  return guarded(async () => {
    // The action takes `id` separately, so the schema's `id` is omitted.
    ScheduleUpdateSchema.omit({ id: true }).parse(data);
    const clientIds = [...new Set(data.clientIds)];
    const schedule = await transactionWithNotifications(async (tx) => {
      await loadScheduleForMutation(tx, user, id, clientIds);
      await assertAllClienteAccess(user, clientIds, tx);
      await assertActiveClients(tx, clientIds);
      await tx.schedule.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description || null,
          scheduledAt: data.scheduledAt,
          endDate: data.endDate || null,
          statusId: data.statusId ?? null,
        },
      });
      await syncScheduleClients(tx, id, clientIds);
      return tx.schedule.findUnique({
        where: { id },
        include: scheduleInclude,
      });
    });

    revalidatePath("/admin/schedules");
    revalidatePath(`/admin/schedules/${id}`);
    revalidatePath("/admin/programacion");
    return { data: schedule };
  });
}

/**
 * Lightweight update used from list/calendar quick-edit dialog.
 * Only touches Clients + date range.
 */
export async function quickUpdateSchedule(
  id: string,
  data: ScheduleQuickUpdateData,
) {
  const user = await requirePermission("schedules:update");

  return guarded(async () => {
    ScheduleQuickUpdateSchema.parse(data);
    const clientIds = [...new Set(data.clientIds)];
    if (data.endDate && data.endDate < data.scheduledAt) {
      return rejected(
        "La fecha de fin no puede ser anterior a la fecha de inicio",
      );
    }
    await transactionWithNotifications(async (tx) => {
      await loadScheduleForMutation(tx, user, id, clientIds);
      await assertAllClienteAccess(user, clientIds, tx);
      await assertActiveClients(tx, clientIds);
      await tx.schedule.update({
        where: { id },
        data: {
          scheduledAt: data.scheduledAt,
          endDate: data.endDate ?? null,
        },
      });
      await syncScheduleClients(tx, id, clientIds);
    });

    revalidatePath("/admin/schedules");
    revalidatePath(`/admin/schedules/${id}`);
    revalidatePath("/admin/programacion");
    return {};
  });
}

/**
 * Delete schedule (soft delete)
 */
export async function deleteSchedule(id: string) {
  const user = await requirePermission("schedules:delete");
  return guarded(async () => {
    await transactionWithNotifications(async (tx) => {
      await loadScheduleForMutation(tx, user, id);
      const incidentCount = await tx.incident.count({
        where: { scheduleId: id, active: true },
      });
      if (incidentCount > 0)
        businessRule(
          `No se puede eliminar: ${incidentCount} incidente(s) están vinculados a esta programación.`,
        );
      await tx.schedule.update({
        where: { id, active: true },
        data: { active: false },
      });
    });
    revalidatePath("/admin/schedules");
    revalidatePath("/admin/programacion");
    redirect("/admin/schedules");
  });
}

/**
 * Get Clients for schedule form. Filtered by the caller's accessible Clients.
 */
export async function getClientsForSchedules() {
  const user = await requirePermission("schedules:read");
  const scope = await getReportScope(user);

  // Client owns no `clientId` column, so the scope resolves to its own ids.
  const clients = await prisma.client.findMany({
    where:
      scope.clientIds === null
        ? { active: true }
        : { active: true, id: { in: scope.clientIds } },
    orderBy: { name: "asc" },
  });

  return clients;
}
