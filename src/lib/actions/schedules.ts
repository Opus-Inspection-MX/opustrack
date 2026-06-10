"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { canAccessCliente, getClienteWhereClause } from "@/lib/auth/filters";
import { prisma } from "@/lib/database/prisma.singleton";

export type ScheduleFormData = {
  title: string;
  description?: string;
  scheduledAt: Date;
  endDate?: Date | null;
  statusId?: number | null;
  clienteIds: string[];
};

export type ScheduleQuickUpdateData = {
  clienteIds: string[];
  scheduledAt: Date;
  endDate?: Date | null;
};

const scheduleInclude = {
  clientes: {
    where: { active: true },
    include: {
      cliente: { select: { id: true, code: true, name: true } },
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
  clienteId?: string;
  statusId?: number;
  activeFrom?: Date;
  activeTo?: Date;
}) {
  await requirePermission("schedules:read");

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.ScheduleWhereInput = {
    active: true,
    ...overlapWhere(params?.activeFrom, params?.activeTo),
  };

  if (params?.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params?.clienteId) {
    where.clientes = { some: { clienteId: params.clienteId, active: true } };
  }

  if (params?.statusId) {
    where.statusId = params.statusId;
  }

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
  await requirePermission("schedules:read");

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      clientes: {
        where: { active: true },
        include: {
          cliente: { select: { id: true, code: true, name: true } },
        },
      },
      incidents: {
        where: { active: true },
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
  clienteIds: string[],
) {
  for (const v of clienteIds) {
    if (!canAccessCliente(user, v)) {
      throw new Error(`Sin acceso al Cliente ${v}`);
    }
  }
}

/**
 * Create new schedule
 */
export async function createSchedule(data: ScheduleFormData) {
  const user = await requirePermission("schedules:create");
  const clienteIds = [...new Set(data.clienteIds)];
  if (clienteIds.length === 0) {
    throw new Error("Selecciona al menos un Cliente");
  }
  await assertAllClienteAccess(user, clienteIds);

  const schedule = await prisma.$transaction(async (tx) => {
    const created = await tx.schedule.create({
      data: {
        title: data.title,
        description: data.description || null,
        scheduledAt: data.scheduledAt,
        endDate: data.endDate || null,
        statusId: data.statusId ?? null,
      },
    });
    await tx.scheduleCliente.createMany({
      data: clienteIds.map((clienteId) => ({
        scheduleId: created.id,
        clienteId,
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
  return { success: true, data: schedule };
}

async function syncScheduleClientes(
  tx: Prisma.TransactionClient,
  scheduleId: string,
  clienteIds: string[],
) {
  const current = await tx.scheduleCliente.findMany({
    where: { scheduleId },
    select: { clienteId: true, active: true },
  });
  const desired = new Set(clienteIds);
  const currentActive = new Set(
    current.filter((c) => c.active).map((c) => c.clienteId),
  );
  const currentInactive = new Set(
    current.filter((c) => !c.active).map((c) => c.clienteId),
  );

  const toDeactivate = [...currentActive].filter((v) => !desired.has(v));
  const toActivate = [...desired].filter((v) => currentInactive.has(v));
  const toCreate = [...desired].filter(
    (v) => !currentActive.has(v) && !currentInactive.has(v),
  );

  if (toDeactivate.length) {
    await tx.scheduleCliente.updateMany({
      where: { scheduleId, clienteId: { in: toDeactivate } },
      data: { active: false },
    });
  }
  if (toActivate.length) {
    await tx.scheduleCliente.updateMany({
      where: { scheduleId, clienteId: { in: toActivate } },
      data: { active: true },
    });
  }
  if (toCreate.length) {
    await tx.scheduleCliente.createMany({
      data: toCreate.map((clienteId) => ({ scheduleId, clienteId })),
      skipDuplicates: true,
    });
  }
}

/**
 * Update existing schedule
 */
export async function updateSchedule(id: string, data: ScheduleFormData) {
  const user = await requirePermission("schedules:update");
  const clienteIds = [...new Set(data.clienteIds)];
  if (clienteIds.length === 0) {
    throw new Error("Selecciona al menos un Cliente");
  }
  await assertAllClienteAccess(user, clienteIds);

  const schedule = await prisma.$transaction(async (tx) => {
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
    await syncScheduleClientes(tx, id, clienteIds);
    return tx.schedule.findUnique({
      where: { id },
      include: scheduleInclude,
    });
  });

  revalidatePath("/admin/schedules");
  revalidatePath(`/admin/schedules/${id}`);
  revalidatePath("/admin/programacion");
  return { success: true, data: schedule };
}

/**
 * Lightweight update used from list/calendar quick-edit dialog.
 * Only touches Clientes + date range.
 */
export async function quickUpdateSchedule(
  id: string,
  data: ScheduleQuickUpdateData,
) {
  const user = await requirePermission("schedules:update");
  const clienteIds = [...new Set(data.clienteIds)];
  if (clienteIds.length === 0) {
    throw new Error("Selecciona al menos un Cliente");
  }
  if (data.endDate && data.endDate < data.scheduledAt) {
    throw new Error(
      "La fecha de fin no puede ser anterior a la fecha de inicio",
    );
  }
  await assertAllClienteAccess(user, clienteIds);

  await prisma.$transaction(async (tx) => {
    await tx.schedule.update({
      where: { id },
      data: {
        scheduledAt: data.scheduledAt,
        endDate: data.endDate ?? null,
      },
    });
    await syncScheduleClientes(tx, id, clienteIds);
  });

  revalidatePath("/admin/schedules");
  revalidatePath(`/admin/schedules/${id}`);
  revalidatePath("/admin/programacion");
  return { success: true };
}

/**
 * Delete schedule (soft delete)
 */
export async function deleteSchedule(id: string) {
  await requirePermission("schedules:delete");

  const incidentCount = await prisma.incident.count({
    where: { scheduleId: id, active: true },
  });

  if (incidentCount > 0) {
    throw new Error(
      `Cannot delete schedule. ${incidentCount} incident(s) are linked to this schedule.`,
    );
  }

  await prisma.schedule.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/schedules");
  redirect("/admin/schedules");
}

/**
 * Get Clientes for schedule form. Filtered by the caller's accessible Clientes.
 */
export async function getClientesForSchedules() {
  const user = await requirePermission("schedules:read");

  const clientes = await prisma.cliente.findMany({
    where: { active: true, ...getClienteWhereClause(user) },
    orderBy: { name: "asc" },
  });

  return clientes;
}
