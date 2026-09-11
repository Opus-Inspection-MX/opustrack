"use server";

import { revalidatePath } from "next/cache";
import { loadAssignmentFor } from "@/lib/auth/access";
import { requirePermission } from "@/lib/auth/auth";
import { assignmentScopeWhere, getReportScope } from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";
import { isFsrUnavailable } from "@/lib/utils/availability";
import { BusinessRuleError, businessRule, guarded } from "./result";

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
    businessRule(
      name === "CANCELADA"
        ? "La incidencia está cancelada. No se pueden hacer cambios."
        : "La incidencia está cerrada. No se pueden hacer cambios.",
    );
  }
}

/**
 * Get all assignment activities (admin view)
 *
 * Scoped to the caller's Clients through the assignment's incident (H-03):
 * the old query returned every Client's activities to anyone who could read.
 */
export async function getAllAssignmentActivities() {
  const user = await requirePermission("assignments:read");
  const scope = await getReportScope(user);

  const activities = await prisma.assignmentActivity.findMany({
    where: {
      active: true,
      assignment: assignmentScopeWhere(scope),
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
    },
    orderBy: { performedAt: "desc" },
  });

  return activities;
}

/**
 * Get assignment activities for an assignment
 */
export async function getAssignmentActivities(assignmentId: string) {
  const user = await requirePermission("assignments:read");
  try {
    await loadAssignmentFor(user, assignmentId, "reader");
  } catch (error) {
    // List reads answer empty: no leak, and the pages keep rendering.
    if (error instanceof BusinessRuleError) return [];
    throw error;
  }

  const activities = await prisma.assignmentActivity.findMany({
    where: {
      assignmentId,
      active: true,
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
  const user = await requirePermission("assignments:update");

  return guarded(async () => {
    // Worker gate: logging work on someone's assignment needs membership.
    await loadAssignmentFor(user, data.assignmentId, "worker");
    await assertAssignmentEditable(data.assignmentId);

    // Resolve effective performedAt — caller-supplied value or now.
    const performedAt = data.performedAt ?? new Date();

    // Load all active assignees for the assignment (FSRs doing the work).
    const assigneeRows = await prisma.assignmentAssignee.findMany({
      where: { assignmentId: data.assignmentId, active: true },
      select: { userId: true, user: { select: { name: true } } },
    });

    // Availability block: reject if any active FSR assignee is unavailable on
    // the CDMX calendar day of performedAt (RF-258/RF-705).
    for (const row of assigneeRows) {
      const unavailable = await isFsrUnavailable(row.userId, performedAt);
      if (unavailable) {
        const label = row.user?.name ?? row.userId;
        businessRule(
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
    return { data: activity };
  });
}

/**
 * Update assignment activity
 */
export async function updateAssignmentActivity(
  id: string,
  data: Partial<AssignmentActivityFormData>,
) {
  const user = await requirePermission("assignments:update");

  return guarded(async () => {
    const ref0 = await prisma.assignmentActivity.findUnique({
      where: { id },
      select: { assignmentId: true },
    });
    if (ref0) {
      await loadAssignmentFor(user, ref0.assignmentId, "worker");
      await assertAssignmentEditable(ref0.assignmentId);
    }

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

    return { data: activity };
  });
}

/**
 * Delete assignment activity
 */
export async function deleteAssignmentActivity(id: string) {
  const user = await requirePermission("assignments:delete");

  return guarded(async () => {
    const activity = await prisma.assignmentActivity.findUnique({
      where: { id },
      select: { assignmentId: true },
    });

    if (activity) {
      await loadAssignmentFor(user, activity.assignmentId, "worker");
      await assertAssignmentEditable(activity.assignmentId);
    }

    await prisma.assignmentActivity.update({
      where: { id },
      data: { active: false },
    });

    if (activity) {
      revalidatePath(`/admin/assignments/${activity.assignmentId}`);
      revalidatePath(`/fsr/assignments/${activity.assignmentId}`);
    }

    return {};
  });
}

/**
 * Get assignment activity by ID
 *
 * Reader gate through the parent assignment (H-03): the old query returned
 * any activity — including its assignees' user rows — to any reader.
 */
export async function getAssignmentActivityById(id: string) {
  const user = await requirePermission("assignments:read");

  const ref = await prisma.assignmentActivity.findUnique({
    where: { id },
    select: { assignmentId: true },
  });
  if (!ref) return null;
  try {
    await loadAssignmentFor(user, ref.assignmentId, "reader");
  } catch (error) {
    // Reads answer "not found": the page turns null into notFound(), and a
    // denial must not confirm the row exists either.
    if (error instanceof BusinessRuleError) return null;
    throw error;
  }

  const activity = await prisma.assignmentActivity.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          incident: true,
          assignees: {
            where: { active: true },
            // H-01: the detail screen renders `a.user.name` only. A bare
            // `user: true` used to ship the password hash to the browser.
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  return activity;
}
