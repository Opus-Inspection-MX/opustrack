"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

export type ScheduleFormData = {
  title: string;
  description?: string;
  type?: "DIARIA" | "MENSUAL";
  scheduledAt: Date;
  endDate?: Date;
  vicId: string;
};

/**
 * Get all schedules with pagination, search, and filters
 */
export async function getSchedules(params?: {
  page?: number;
  limit?: number;
  search?: string;
  vicId?: string;
  statusId?: number;
  startDate?: string;
  endDate?: string;
}) {
  await requirePermission("schedules:read");

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.ScheduleWhereInput = {
    active: true,
  };

  // Search by title or description
  if (params?.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  // Filter by VIC
  if (params?.vicId) {
    where.vicId = params.vicId;
  }

  // Filter by status
  if (params?.statusId) {
    where.statusId = params.statusId;
  }

  // Filter by date range
  if (params?.startDate || params?.endDate) {
    where.scheduledAt = {};
    if (params.startDate) {
      where.scheduledAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      where.scheduledAt.lte = new Date(params.endDate);
    }
  }

  // Get total count
  const total = await prisma.schedule.count({ where });

  // Get paginated schedules
  const schedules = await prisma.schedule.findMany({
    where,
    include: {
      vic: true,
      _count: {
        select: { incidents: true },
      },
    },
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
      vic: true,
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

/**
 * Create new schedule
 */
export async function createSchedule(data: ScheduleFormData) {
  await requirePermission("schedules:create");

  const schedule = await prisma.schedule.create({
    data: {
      title: data.title,
      description: data.description || null,
      type: data.type || "DIARIA",
      scheduledAt: data.scheduledAt,
      endDate: data.endDate || null,
      vicId: data.vicId,
    },
    include: {
      vic: true,
    },
  });

  revalidatePath("/admin/schedules");
  return { success: true, data: schedule };
}

/**
 * Update existing schedule
 */
export async function updateSchedule(id: string, data: ScheduleFormData) {
  await requirePermission("schedules:update");

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description || null,
      ...(data.type ? { type: data.type } : {}),
      scheduledAt: data.scheduledAt,
      endDate: data.endDate || null,
      vicId: data.vicId,
    },
    include: {
      vic: true,
    },
  });

  revalidatePath("/admin/schedules");
  revalidatePath(`/admin/schedules/${id}`);
  return { success: true, data: schedule };
}

/**
 * Delete schedule (soft delete)
 */
export async function deleteSchedule(id: string) {
  await requirePermission("schedules:delete");

  // Check if schedule has incidents
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
 * Get VICs for schedule form
 */
export async function getVICsForSchedules() {
  await requirePermission("schedules:read");

  const vics = await prisma.vehicleInspectionCenter.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return vics;
}
