"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { getVicWhereClause } from "@/lib/auth/filters";
import { prisma } from "@/lib/database/prisma.singleton";

export type AssignmentFormData = {
  incidentId: number;
  assignedToId: string;
  statusId?: number | null;
  notes?: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

/**
 * Get all assignments
 * Filtered by user's VIC (except ADMINISTRADOR who sees all)
 */
export async function getAssignments() {
  const user = await requirePermission("assignments:read");
  const vicFilter = getVicWhereClause(user);

  const assignments = await prisma.assignment.findMany({
    where: {
      active: true,
      incident: { ...vicFilter },
    },
    include: {
      incident: {
        include: {
          type: true,
          status: true,
          vic: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      assignmentActivities: {
        where: { active: true },
        orderBy: { performedAt: "desc" },
      },
      _count: {
        select: {
          assignmentActivities: true,
          workParts: true,
        },
      },
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return assignments;
}

/**
 * Get single assignment by ID
 */
export async function getAssignmentById(id: string) {
  const user = await requirePermission("assignments:read");

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      incident: {
        include: {
          type: true,
          status: true,
          vic: true,
          reportedBy: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      assignmentActivities: {
        where: { active: true },
        include: {
          workParts: {
            include: {
              part: true,
            },
          },
        },
        orderBy: { performedAt: "desc" },
      },
      workParts: {
        where: { active: true },
        include: {
          part: true,
        },
      },
      attachments: {
        where: { active: true },
      },
      status: true,
    },
  });

  // Verify VIC access for non-admin users
  if (assignment?.incident?.vicId) {
    const { assertVicAccess } = await import("@/lib/auth/filters");
    assertVicAccess(user, assignment.incident.vicId);
  }

  return assignment;
}

/**
 * Create new assignment
 */
export async function createAssignment(data: AssignmentFormData) {
  await requirePermission("assignments:create");

  const assignment = await prisma.assignment.create({
    data: {
      incidentId: data.incidentId,
      assignedToId: data.assignedToId,
      statusId: data.statusId || null,
      notes: data.notes || null,
      startedAt: data.startedAt || null,
      finishedAt: data.finishedAt || null,
      assignedAt: new Date(),
    },
    include: {
      incident: true,
      assignedTo: true,
      status: true,
    },
  });

  // Notify assigned FSR
  if (data.assignedToId) {
    try {
      const { createNotification } = await import(
        "@/lib/notifications/notification-service"
      );
      const { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } = await import(
        "@/lib/notifications/notification-types"
      );

      await createNotification({
        userId: data.assignedToId,
        title: "Nueva asignación",
        message: `Se te ha asignado una nueva asignación${assignment.incident?.title ? ` para el incidente: ${assignment.incident.title}` : ""}`,
        type: NOTIFICATION_TYPES.ASSIGNMENT_ASSIGNED,
        entityType: "assignment",
        entityId: assignment.id,
        actionUrl: `/fsr/assignments/${assignment.id}`,
        priority: NOTIFICATION_PRIORITY.HIGH,
      });
    } catch (error) {
      console.error("Error creating assignment notification:", error);
    }
  }

  revalidatePath("/admin/assignments");
  revalidatePath("/fsr/assignments");
  revalidatePath(`/admin/incidents/${data.incidentId}`);
  return { success: true, data: assignment };
}

/**
 * Update existing assignment
 */
export async function updateAssignment(id: string, data: AssignmentFormData) {
  await requirePermission("assignments:update");

  const currentAssignment = await prisma.assignment.findUnique({
    where: { id },
    select: { assignedToId: true },
  });

  const isReassignment = currentAssignment?.assignedToId !== data.assignedToId;

  const assignment = await prisma.assignment.update({
    where: { id },
    data: {
      assignedToId: data.assignedToId,
      statusId: data.statusId || null,
      notes: data.notes || null,
      startedAt: data.startedAt || null,
      finishedAt: data.finishedAt || null,
      ...(isReassignment && {
        assignedAt: new Date(),
        unlockedAt: null,
      }),
    },
    include: {
      incident: true,
      assignedTo: true,
      status: true,
    },
  });

  if (isReassignment && data.assignedToId) {
    try {
      const { createNotification } = await import(
        "@/lib/notifications/notification-service"
      );
      const { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } = await import(
        "@/lib/notifications/notification-types"
      );

      await createNotification({
        userId: data.assignedToId,
        title: "Asignación asignada",
        message: `Se te ha asignado la asignación${assignment.incident?.title ? ` para el incidente: ${assignment.incident.title}` : ""}`,
        type: NOTIFICATION_TYPES.ASSIGNMENT_ASSIGNED,
        entityType: "assignment",
        entityId: id,
        actionUrl: `/fsr/assignments/${id}`,
        priority: NOTIFICATION_PRIORITY.HIGH,
      });
    } catch (error) {
      console.error("Error creating reassignment notification:", error);
    }
  }

  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${id}`);
  revalidatePath(`/admin/incidents/${assignment.incidentId}`);
  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${id}`);
  return { success: true, data: assignment };
}

/**
 * Delete assignment (soft delete)
 */
export async function deleteAssignment(id: string) {
  await requirePermission("assignments:delete");

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findUnique({
      where: { id },
      select: {
        incidentId: true,
        _count: {
          select: {
            workParts: { where: { active: true } },
            assignmentActivities: { where: { active: true } },
            attachments: { where: { active: true } },
          },
        },
      },
    });

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    const hasActiveParts = assignment._count.workParts > 0;
    const hasActiveActivities = assignment._count.assignmentActivities > 0;
    const hasActiveAttachments = assignment._count.attachments > 0;

    if (hasActiveParts || hasActiveActivities || hasActiveAttachments) {
      const issues = [];
      if (hasActiveParts)
        issues.push(`${assignment._count.workParts} parte(s)`);
      if (hasActiveActivities)
        issues.push(`${assignment._count.assignmentActivities} actividad(es)`);
      if (hasActiveAttachments)
        issues.push(`${assignment._count.attachments} archivo(s)`);
      throw new Error(
        `No se puede eliminar. La asignación tiene: ${issues.join(", ")} activos.`,
      );
    }

    await tx.assignment.update({
      where: { id },
      data: { active: false },
    });

    return { incidentId: assignment.incidentId };
  });

  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/incidents/${result.incidentId}`);
  redirect("/admin/assignments");
}

/**
 * Complete assignment (FSR functionality)
 * Sets status to COMPLETADO and finishedAt timestamp
 * Auto-closes incident when all assignments are complete.
 */
export async function completeAssignment(id: string, notes?: string) {
  await requirePermission("assignments:complete");

  const result = await prisma.$transaction(async (tx) => {
    const activityCount = await tx.assignmentActivity.count({
      where: { assignmentId: id, active: true },
    });

    if (activityCount === 0) {
      throw new Error(
        "No se puede completar la asignación sin actividades de trabajo documentadas",
      );
    }

    const completadoStatus = await tx.assignmentStatus.findFirst({
      where: { name: "COMPLETADO" },
    });

    if (!completadoStatus) {
      throw new Error("COMPLETADO status not found in database");
    }

    const assignment = await tx.assignment.update({
      where: { id },
      data: {
        finishedAt: new Date(),
        statusId: completadoStatus.id,
        notes: notes || null,
      },
      include: {
        incident: true,
        assignedTo: true,
        status: true,
      },
    });

    const incidentAssignments = await tx.assignment.findMany({
      where: {
        incidentId: assignment.incidentId,
        active: true,
      },
      include: { status: true },
    });

    const allCompleted = incidentAssignments.every(
      (a) => a.finishedAt !== null || a.status?.name === "COMPLETADO",
    );

    let incidentAutoClosed = false;

    if (allCompleted && incidentAssignments.length > 0) {
      const cerradoStatus = await tx.incidentStatus.findFirst({
        where: { name: "CERRADO" },
      });

      if (!cerradoStatus) {
        throw new Error("CERRADO incident status not found in database");
      }

      await tx.incident.update({
        where: { id: assignment.incidentId },
        data: {
          statusId: cerradoStatus.id,
          resolvedAt: new Date(),
        },
      });
      incidentAutoClosed = true;
      console.log(
        `[AUTO-CLOSE] Incident #${assignment.incidentId} auto-closed - all assignments completed`,
      );
    }

    return {
      assignment,
      incidentAutoClosed,
      incidentId: assignment.incidentId,
    };
  });

  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${id}`);
  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${id}`);
  if (result.incidentAutoClosed) {
    revalidatePath(`/admin/incidents/${result.incidentId}`);
    revalidatePath("/admin/incidents");
    revalidatePath("/client/incidents");
  }
  return {
    success: true,
    data: result.assignment,
    incidentAutoClosed: result.incidentAutoClosed,
  };
}

/**
 * Start assignment (FSR functionality)
 * Sets status to EN_PROGRESO and startedAt timestamp
 */
export async function startAssignment(id: string) {
  await requirePermission("assignments:update");

  const enProgresoStatus = await prisma.assignmentStatus.findFirst({
    where: { name: "EN_PROGRESO" },
  });

  if (!enProgresoStatus) {
    throw new Error("EN_PROGRESO assignment status not found in database");
  }

  const assignment = await prisma.assignment.update({
    where: { id },
    data: {
      startedAt: new Date(),
      statusId: enProgresoStatus.id,
    },
    include: {
      incident: true,
      assignedTo: true,
      status: true,
    },
  });

  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${id}`);
  revalidatePath("/admin/assignments");
  return { success: true, data: assignment };
}

/**
 * Unlock/Acknowledge assignment (FSR functionality)
 */
export async function unlockAssignment(id: string) {
  const user = await requirePermission("assignments:update");

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      assignedToId: true,
      unlockedAt: true,
    },
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  if (assignment.unlockedAt) {
    return { success: true, alreadyUnlocked: true };
  }

  const userWithRole = await prisma.user.findUnique({
    where: { id: user.id },
    include: { role: true },
  });

  if (
    userWithRole?.role?.name !== "ADMINISTRADOR" &&
    assignment.assignedToId !== user.id
  ) {
    throw new Error("Only the assigned FSR can unlock this assignment");
  }

  const updatedAssignment = await prisma.assignment.update({
    where: { id },
    data: {
      unlockedAt: new Date(),
    },
    include: {
      incident: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      status: true,
    },
  });

  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${id}`);
  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${id}`);
  revalidatePath("/admin/tracking");

  return { success: true, data: updatedAssignment };
}

/**
 * Reopen assignment (FSR functionality)
 * Sets status to PENDIENTE and clears finishedAt timestamp
 * Also reopens incident if it was auto-closed
 */
export async function reopenAssignment(id: string) {
  await requirePermission("assignments:update");

  const result = await prisma.$transaction(async (tx) => {
    const pendienteStatus = await tx.assignmentStatus.findFirst({
      where: { name: "PENDIENTE" },
    });

    if (!pendienteStatus) {
      throw new Error("PENDIENTE assignment status not found in database");
    }

    const enProgresoStatus = await tx.incidentStatus.findFirst({
      where: { name: "EN_PROGRESO" },
    });

    const assignment = await tx.assignment.update({
      where: { id },
      data: {
        finishedAt: null,
        statusId: pendienteStatus.id,
      },
      include: {
        incident: {
          include: { status: true },
        },
        assignedTo: true,
        status: true,
      },
    });

    let incidentReopened = false;

    if (assignment.incident.status?.name === "CERRADO" && enProgresoStatus) {
      await tx.incident.update({
        where: { id: assignment.incidentId },
        data: {
          statusId: enProgresoStatus.id,
          resolvedAt: null,
        },
      });
      incidentReopened = true;
      console.log(
        `[REOPEN] Incident #${assignment.incidentId} reopened - assignment #${id} reopened`,
      );
    }

    return { assignment, incidentReopened, incidentId: assignment.incidentId };
  });

  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${id}`);
  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${id}`);
  if (result.incidentReopened) {
    revalidatePath(`/admin/incidents/${result.incidentId}`);
    revalidatePath("/admin/incidents");
    revalidatePath("/client/incidents");
  }
  return {
    success: true,
    data: result.assignment,
    incidentReopened: result.incidentReopened,
  };
}

/**
 * Get assignments assigned to current user (FSR)
 */
export async function getMyAssignments() {
  const user = await requirePermission("assignments:read");

  const assignments = await prisma.assignment.findMany({
    where: {
      assignedToId: user.id,
      active: true,
    },
    include: {
      incident: {
        include: {
          type: true,
          status: true,
          vic: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          assignmentActivities: true,
          workParts: true,
        },
      },
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return assignments;
}

/**
 * Get form options for assignments
 */
export async function getAssignmentFormOptions() {
  await requirePermission("assignments:read");

  const [incidents, users, assignmentStatuses] = await Promise.all([
    prisma.incident.findMany({
      where: { active: true },
      include: {
        type: true,
        status: true,
        vic: true,
      },
      orderBy: { reportedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        vicAssignments: {
          where: { active: true },
          select: { vicId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.assignmentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const usersWithVicIds = users.map((user) => ({
    ...user,
    vicIds: user.vicAssignments.map((va) => va.vicId),
  }));

  return { incidents, users: usersWithVicIds, assignmentStatuses };
}

/**
 * Upload attachment for assignment
 */
export async function uploadAssignmentAttachment(
  assignmentId: string,
  fileData: {
    filename: string;
    base64Data: string;
    mimetype: string;
    size: number;
    description?: string;
  },
) {
  await requirePermission("assignments:update");

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (fileData.size > MAX_FILE_SIZE) {
    throw new Error(
      `El archivo es demasiado grande. Tamaño máximo: 10MB, Tamaño del archivo: ${(fileData.size / (1024 * 1024)).toFixed(1)}MB`,
    );
  }

  const { uploadFile } = await import("@/lib/storage/file-storage");

  const uploadResult = await uploadFile(
    fileData.filename,
    fileData.base64Data,
    fileData.mimetype,
    { subfolder: "assignments" },
  );

  const attachment = await prisma.assignmentAttachment.create({
    data: {
      assignmentId,
      filename: uploadResult.filename,
      filepath: uploadResult.url,
      mimetype: uploadResult.mimetype,
      size: uploadResult.size,
      description: fileData.description || null,
      provider: uploadResult.provider,
    },
  });

  revalidatePath(`/admin/assignments/${assignmentId}`);
  revalidatePath(`/fsr/assignments/${assignmentId}`);

  return { success: true, data: attachment };
}

/**
 * Delete assignment attachment
 */
export async function deleteAssignmentAttachment(id: string) {
  await requirePermission("assignments:update");

  const attachment = await prisma.assignmentAttachment.findUnique({
    where: { id },
  });

  if (!attachment) {
    throw new Error("Attachment not found");
  }

  await prisma.assignmentAttachment.update({
    where: { id },
    data: { active: false },
  });

  try {
    const { deleteFile } = await import("@/lib/storage/file-storage");
    await deleteFile(
      attachment.filepath,
      attachment.provider as "vercel-blob" | "filesystem",
    );
  } catch (error) {
    console.error("Error deleting file:", error);
  }

  revalidatePath(`/admin/assignments/${attachment.assignmentId}`);
  revalidatePath(`/fsr/assignments/${attachment.assignmentId}`);

  return { success: true };
}

/**
 * Update assignment status (FSR functionality)
 */
export async function updateAssignmentStatus(id: string, statusId: number) {
  await requirePermission("assignments:update");

  const assignment = await prisma.assignment.update({
    where: { id },
    data: {
      statusId,
    },
    include: {
      incident: true,
      assignedTo: true,
      status: true,
    },
  });

  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${id}`);
  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${id}`);
  return { success: true, data: assignment };
}
