"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { canAccessVic, getVicWhereClause } from "@/lib/auth/filters";
import { prisma } from "@/lib/database/prisma.singleton";

export type ScheduleFormData = {
  title: string;
  description?: string;
  scheduledAt: Date;
  endDate?: Date | null;
  statusId?: number | null;
  vicIds: string[];
};

export type ScheduleQuickUpdateData = {
  vicIds: string[];
  scheduledAt: Date;
  endDate?: Date | null;
};

const scheduleInclude = {
  vics: {
    where: { active: true },
    include: {
      vic: { select: { id: true, code: true, name: true } },
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
  vicId?: string;
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

  if (params?.vicId) {
    where.vics = { some: { vicId: params.vicId, active: true } };
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
      vics: {
        where: { active: true },
        include: {
          vic: { select: { id: true, code: true, name: true } },
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

async function assertAllVicAccess(
  user: Awaited<ReturnType<typeof requirePermission>>,
  vicIds: string[],
) {
  for (const v of vicIds) {
    if (!canAccessVic(user, v)) {
      throw new Error(`Sin acceso al VIC ${v}`);
    }
  }
}

/**
 * Create new schedule
 */
export async function createSchedule(data: ScheduleFormData) {
  const user = await requirePermission("schedules:create");
  const vicIds = [...new Set(data.vicIds)];
  if (vicIds.length === 0) {
    throw new Error("Selecciona al menos un VIC");
  }
  await assertAllVicAccess(user, vicIds);

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
    await tx.scheduleVic.createMany({
      data: vicIds.map((vicId) => ({ scheduleId: created.id, vicId })),
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

async function syncScheduleVics(
  tx: Prisma.TransactionClient,
  scheduleId: string,
  vicIds: string[],
) {
  const current = await tx.scheduleVic.findMany({
    where: { scheduleId },
    select: { vicId: true, active: true },
  });
  const desired = new Set(vicIds);
  const currentActive = new Set(
    current.filter((c) => c.active).map((c) => c.vicId),
  );
  const currentInactive = new Set(
    current.filter((c) => !c.active).map((c) => c.vicId),
  );

  const toDeactivate = [...currentActive].filter((v) => !desired.has(v));
  const toActivate = [...desired].filter((v) => currentInactive.has(v));
  const toCreate = [...desired].filter(
    (v) => !currentActive.has(v) && !currentInactive.has(v),
  );

  if (toDeactivate.length) {
    await tx.scheduleVic.updateMany({
      where: { scheduleId, vicId: { in: toDeactivate } },
      data: { active: false },
    });
  }
  if (toActivate.length) {
    await tx.scheduleVic.updateMany({
      where: { scheduleId, vicId: { in: toActivate } },
      data: { active: true },
    });
  }
  if (toCreate.length) {
    await tx.scheduleVic.createMany({
      data: toCreate.map((vicId) => ({ scheduleId, vicId })),
      skipDuplicates: true,
    });
  }
}

/**
 * Update existing schedule
 */
export async function updateSchedule(id: string, data: ScheduleFormData) {
  const user = await requirePermission("schedules:update");
  const vicIds = [...new Set(data.vicIds)];
  if (vicIds.length === 0) {
    throw new Error("Selecciona al menos un VIC");
  }
  await assertAllVicAccess(user, vicIds);

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
    await syncScheduleVics(tx, id, vicIds);
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
 * Only touches VICs + date range.
 */
export async function quickUpdateSchedule(
  id: string,
  data: ScheduleQuickUpdateData,
) {
  const user = await requirePermission("schedules:update");
  const vicIds = [...new Set(data.vicIds)];
  if (vicIds.length === 0) {
    throw new Error("Selecciona al menos un VIC");
  }
  if (data.endDate && data.endDate < data.scheduledAt) {
    throw new Error(
      "La fecha de fin no puede ser anterior a la fecha de inicio",
    );
  }
  await assertAllVicAccess(user, vicIds);

  await prisma.$transaction(async (tx) => {
    await tx.schedule.update({
      where: { id },
      data: {
        scheduledAt: data.scheduledAt,
        endDate: data.endDate ?? null,
      },
    });
    await syncScheduleVics(tx, id, vicIds);
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
 * Get VICs for schedule form. Filtered by the caller's accessible VICs.
 */
export async function getVICsForSchedules() {
  const user = await requirePermission("schedules:read");

  const vics = await prisma.vehicleInspectionCenter.findMany({
    where: { active: true, ...getVicWhereClause(user) },
    orderBy: { name: "asc" },
  });

  return vics;
}
