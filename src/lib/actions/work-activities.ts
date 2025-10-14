"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

export type WorkActivityFormData = {
  workOrderId: string;
  description: string;
  performedAt?: Date;
};

/**
 * Get all work activities (admin view)
 */
export async function getAllWorkActivities() {
  await requirePermission("work-orders:read");

  const activities = await prisma.workActivity.findMany({
    where: {
      active: true,
    },
    include: {
      workOrder: {
        include: {
          incident: {
            select: {
              title: true,
            },
          },
        },
      },
      workParts: {
        where: { active: true },
      },
    },
    orderBy: { performedAt: "desc" },
  });

  return activities;
}

/**
 * Get work activities for a work order
 */
export async function getWorkActivities(workOrderId: string) {
  await requirePermission("work-orders:read");

  const activities = await prisma.workActivity.findMany({
    where: {
      workOrderId,
      active: true,
    },
    include: {
      workParts: {
        where: { active: true },
        include: {
          part: true,
        },
      },
    },
    orderBy: { performedAt: "desc" },
  });

  return activities;
}

/**
 * Create new work activity
 */
export async function createWorkActivity(data: WorkActivityFormData) {
  await requirePermission("work-orders:update");

  const activity = await prisma.workActivity.create({
    data: {
      workOrderId: data.workOrderId,
      description: data.description,
      performedAt: data.performedAt || new Date(),
    },
  });

  revalidatePath(`/admin/work-orders/${data.workOrderId}`);
  return { success: true, data: activity };
}

/**
 * Update work activity
 */
export async function updateWorkActivity(
  id: string,
  data: Partial<WorkActivityFormData>
) {
  await requirePermission("work-orders:update");

  const activity = await prisma.workActivity.update({
    where: { id },
    data: {
      description: data.description,
      performedAt: data.performedAt,
    },
  });

  const workOrder = await prisma.workActivity.findUnique({
    where: { id },
    select: { workOrderId: true },
  });

  if (workOrder) {
    revalidatePath(`/admin/work-orders/${workOrder.workOrderId}`);
  }

  return { success: true, data: activity };
}

/**
 * Delete work activity
 */
export async function deleteWorkActivity(id: string) {
  await requirePermission("work-orders:delete");

  const activity = await prisma.workActivity.findUnique({
    where: { id },
    select: { workOrderId: true },
  });

  await prisma.workActivity.update({
    where: { id },
    data: { active: false },
  });

  if (activity) {
    revalidatePath(`/admin/work-orders/${activity.workOrderId}`);
    revalidatePath(`/fsr/work-orders/${activity.workOrderId}`);
  }

  return { success: true };
}

/**
 * Get work activity by ID
 */
export async function getWorkActivityById(id: string) {
  await requirePermission("work-orders:read");

  const activity = await prisma.workActivity.findUnique({
    where: { id },
    include: {
      workOrder: {
        include: {
          incident: true,
          assignedTo: true,
        },
      },
      workParts: {
        where: { active: true },
        include: {
          part: true,
        },
      },
    },
  });

  return activity;
}
