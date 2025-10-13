"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ScheduleFormData = {
  title: string;
  description?: string;
  scheduledAt: Date;
  vicId: string;
};

/**
 * Get all schedules
 */
export async function getSchedules() {
  await requirePermission("schedules:read");

  const schedules = await prisma.schedule.findMany({
    where: { active: true },
    include: {
      vic: true,
      _count: {
        select: { incidents: true },
      },
    },
    orderBy: { scheduledAt: "desc" },
  });

  return schedules;
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
      scheduledAt: data.scheduledAt,
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
      scheduledAt: data.scheduledAt,
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
      `Cannot delete schedule. ${incidentCount} incident(s) are linked to this schedule.`
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
