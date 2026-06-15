"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { isFsrUnavailable } from "@/lib/utils/availability";

export type AssignmentActivityFormData = {
  assignmentId: string;
  description: string;
  performedAt?: Date;
};

async function assertAssignmentEditable(assignmentId: string): Promise<void> {
  const row = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { incident: { select: { status: { select: { name: true } } } } },
  });
  const name = row?.incident?.status?.name;
  if (name === "CERRADO" || name === "CANCELADA") {
    throw new Error(
      name === "CANCELADA"
        ? "La incidencia está cancelada. No se pueden hacer cambios."
        : "La incidencia está cerrada. No se pueden hacer cambios.",
    );
  }
}

/**
 * Get all assignment activities (admin view)
 */
export async function getAllAssignmentActivities() {
  await requirePermission("assignments:read");

  const activities = await prisma.assignmentActivity.findMany({
    where: {
      active: true,
    },
    include: {
      assignment: {
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
 * Get assignment activities for an assignment
 */
export async function getAssignmentActivities(assignmentId: string) {
  await requirePermission("assignments:read");

  const activities = await prisma.assignmentActivity.findMany({
    where: {
      assignmentId,
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
 * Create new assignment activity
 */
export async function createAssignmentActivity(
  data: AssignmentActivityFormData,
) {
  await requirePermission("assignments:update");
  await assertAssignmentEditable(data.assignmentId);

  // Resolve effective performedAt — caller-supplied value or now.
  const performedAt = data.performedAt ?? new Date();

  // Load all active assignees for the assignment (FSRs doing the work).
  const assigneeRows = await prisma.assignmentAssignee.findMany({
    where: { assignmentId: data.assignmentId, active: true },
    select: { userId: true, user: { select: { name: true } } },
  });

  // Availability block: reject if any active FSR assignee is unavailable on the
  // CDMX calendar day of performedAt (RF-258/RF-705).
  for (const row of assigneeRows) {
    const unavailable = await isFsrUnavailable(row.userId, performedAt);
    if (unavailable) {
      const label = row.user?.name ?? row.userId;
      throw new Error(
        `El técnico ${label} no está disponible en la fecha indicada (día festivo o vacaciones aprobadas).`,
      );
    }
  }

  const activity = await prisma.assignmentActivity.create({
    data: {
      assignmentId: data.assignmentId,
      description: data.description,
      performedAt,
    },
  });

  revalidatePath(`/admin/assignments/${data.assignmentId}`);
  return { success: true, data: activity };
}

/**
 * Update assignment activity
 */
export async function updateAssignmentActivity(
  id: string,
  data: Partial<AssignmentActivityFormData>,
) {
  await requirePermission("assignments:update");

  const ref0 = await prisma.assignmentActivity.findUnique({
    where: { id },
    select: { assignmentId: true },
  });
  if (ref0) await assertAssignmentEditable(ref0.assignmentId);

  const activity = await prisma.assignmentActivity.update({
    where: { id },
    data: {
      description: data.description,
      performedAt: data.performedAt,
    },
  });

  const ref = await prisma.assignmentActivity.findUnique({
    where: { id },
    select: { assignmentId: true },
  });

  if (ref) {
    revalidatePath(`/admin/assignments/${ref.assignmentId}`);
  }

  return { success: true, data: activity };
}

/**
 * Delete assignment activity
 */
export async function deleteAssignmentActivity(id: string) {
  await requirePermission("assignments:delete");

  const activity = await prisma.assignmentActivity.findUnique({
    where: { id },
    select: { assignmentId: true },
  });

  if (activity) await assertAssignmentEditable(activity.assignmentId);

  await prisma.assignmentActivity.update({
    where: { id },
    data: { active: false },
  });

  if (activity) {
    revalidatePath(`/admin/assignments/${activity.assignmentId}`);
    revalidatePath(`/fsr/assignments/${activity.assignmentId}`);
  }

  return { success: true };
}

/**
 * Get assignment activity by ID
 */
export async function getAssignmentActivityById(id: string) {
  await requirePermission("assignments:read");

  const activity = await prisma.assignmentActivity.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          incident: true,
          assignees: {
            where: { active: true },
            include: { user: true },
          },
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
