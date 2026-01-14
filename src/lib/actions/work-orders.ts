"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

export type WorkOrderFormData = {
  incidentId: number;
  assignedToId: string;
  statusId?: number | null;
  notes?: string;
  folio?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

/**
 * Get all work orders
 */
export async function getWorkOrders() {
  await requirePermission("work-orders:read");

  const workOrders = await prisma.workOrder.findMany({
    where: { active: true },
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
      workActivities: {
        where: { active: true },
        orderBy: { performedAt: "desc" },
      },
      _count: {
        select: {
          workActivities: true,
          workParts: true,
        },
      },
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return workOrders;
}

/**
 * Get single work order by ID
 */
export async function getWorkOrderById(id: string) {
  await requirePermission("work-orders:read");

  const workOrder = await prisma.workOrder.findUnique({
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
      workActivities: {
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

  return workOrder;
}

/**
 * Create new work order
 */
export async function createWorkOrder(data: WorkOrderFormData) {
  await requirePermission("work-orders:create");

  const workOrder = await prisma.workOrder.create({
    data: {
      incidentId: data.incidentId,
      assignedToId: data.assignedToId,
      statusId: data.statusId || null,
      notes: data.notes || null,
      folio: data.folio || null,
      startedAt: data.startedAt || null,
      finishedAt: data.finishedAt || null,
    },
    include: {
      incident: true,
      assignedTo: true,
      status: true,
    },
  });

  revalidatePath("/admin/work-orders");
  revalidatePath(`/admin/incidents/${data.incidentId}`);
  return { success: true, data: workOrder };
}

/**
 * Update existing work order
 */
export async function updateWorkOrder(id: string, data: WorkOrderFormData) {
  await requirePermission("work-orders:update");

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: {
      assignedToId: data.assignedToId,
      statusId: data.statusId || null,
      notes: data.notes || null,
      folio: data.folio || null,
      startedAt: data.startedAt || null,
      finishedAt: data.finishedAt || null,
    },
    include: {
      incident: true,
      assignedTo: true,
      status: true,
    },
  });

  revalidatePath("/admin/work-orders");
  revalidatePath(`/admin/work-orders/${id}`);
  revalidatePath(`/admin/incidents/${workOrder.incidentId}`);
  return { success: true, data: workOrder };
}

/**
 * Delete work order (soft delete)
 * Uses transaction to check for active parts/attachments and attempt auto-close incident
 */
export async function deleteWorkOrder(id: string) {
  await requirePermission("work-orders:delete");

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({
      where: { id },
      select: {
        incidentId: true,
        _count: {
          select: {
            workParts: { where: { active: true } },
            workActivities: { where: { active: true } },
            attachments: { where: { active: true } },
          },
        },
      },
    });

    if (!workOrder) {
      throw new Error("Work order not found");
    }

    // Check for active children
    const hasActiveParts = workOrder._count.workParts > 0;
    const hasActiveActivities = workOrder._count.workActivities > 0;
    const hasActiveAttachments = workOrder._count.attachments > 0;

    if (hasActiveParts || hasActiveActivities || hasActiveAttachments) {
      const issues = [];
      if (hasActiveParts) issues.push(`${workOrder._count.workParts} parte(s)`);
      if (hasActiveActivities)
        issues.push(`${workOrder._count.workActivities} actividad(es)`);
      if (hasActiveAttachments)
        issues.push(`${workOrder._count.attachments} archivo(s)`);
      throw new Error(
        `No se puede eliminar. La orden tiene: ${issues.join(", ")} activos.`,
      );
    }

    await tx.workOrder.update({
      where: { id },
      data: { active: false },
    });

    return { incidentId: workOrder.incidentId };
  });

  revalidatePath("/admin/work-orders");
  revalidatePath(`/admin/incidents/${result.incidentId}`);
  redirect("/admin/work-orders");
}

/**
 * Complete work order (FSR functionality)
 * Sets status to CERRADO and finishedAt timestamp
 * Uses transaction to ensure atomicity and auto-close incident if all work orders complete
 */
export async function completeWorkOrder(id: string, notes?: string) {
  await requirePermission("work-orders:complete");

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Get CERRADO status
    const cerradoStatus = await tx.incidentStatus.findFirst({
      where: { name: "CERRADO" },
    });

    if (!cerradoStatus) {
      throw new Error("CERRADO status not found in database");
    }

    const workOrder = await tx.workOrder.update({
      where: { id },
      data: {
        finishedAt: new Date(),
        statusId: cerradoStatus.id,
        notes: notes || null,
      },
      include: {
        incident: true,
        assignedTo: true,
        status: true,
      },
    });

    // Check if all work orders for this incident are completed
    const incidentWorkOrders = await tx.workOrder.findMany({
      where: {
        incidentId: workOrder.incidentId,
        active: true,
      },
      include: { status: true },
    });

    // Check completion by status name or finishedAt timestamp
    const completedStatuses = [
      "CERRADO",
      "COMPLETADO",
      "RESUELTO",
      "FINALIZADO",
    ];
    const allCompleted = incidentWorkOrders.every(
      (wo) =>
        wo.finishedAt !== null ||
        (wo.status?.name && completedStatuses.includes(wo.status.name)),
    );

    let incidentAutoClosed = false;

    if (allCompleted && incidentWorkOrders.length > 0) {
      // Auto-close the incident
      await tx.incident.update({
        where: { id: workOrder.incidentId },
        data: {
          statusId: cerradoStatus.id,
          resolvedAt: new Date(),
        },
      });
      incidentAutoClosed = true;
      console.log(
        `[AUTO-CLOSE] Incident #${workOrder.incidentId} auto-closed - all work orders completed`,
      );
    }

    return { workOrder, incidentAutoClosed, incidentId: workOrder.incidentId };
  });

  revalidatePath("/fsr/work-orders");
  revalidatePath(`/fsr/work-orders/${id}`);
  revalidatePath("/admin/work-orders");
  revalidatePath(`/admin/work-orders/${id}`);
  if (result.incidentAutoClosed) {
    revalidatePath(`/admin/incidents/${result.incidentId}`);
    revalidatePath("/admin/incidents");
    revalidatePath("/client/incidents");
  }
  return {
    success: true,
    data: result.workOrder,
    incidentAutoClosed: result.incidentAutoClosed,
  };
}

/**
 * Start work order (FSR functionality)
 * Sets status to EN_PROGRESO and startedAt timestamp
 */
export async function startWorkOrder(id: string) {
  await requirePermission("work-orders:update");

  // Get EN_PROGRESO status
  const enProgresoStatus = await prisma.incidentStatus.findFirst({
    where: { name: "EN_PROGRESO" },
  });

  if (!enProgresoStatus) {
    throw new Error("EN_PROGRESO status not found in database");
  }

  const workOrder = await prisma.workOrder.update({
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

  revalidatePath("/fsr/work-orders");
  revalidatePath(`/fsr/work-orders/${id}`);
  revalidatePath("/admin/work-orders");
  return { success: true, data: workOrder };
}

/**
 * Reopen work order (FSR functionality)
 * Sets status to PENDIENTE and clears finishedAt timestamp
 * Also reopens incident if it was auto-closed
 */
export async function reopenWorkOrder(id: string) {
  await requirePermission("work-orders:update");

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Get PENDIENTE status for work order
    const pendienteStatus = await tx.incidentStatus.findFirst({
      where: { name: "PENDIENTE" },
    });

    if (!pendienteStatus) {
      throw new Error("PENDIENTE status not found in database");
    }

    // Get EN_PROGRESO status for incident
    const enProgresoStatus = await tx.incidentStatus.findFirst({
      where: { name: "EN_PROGRESO" },
    });

    const workOrder = await tx.workOrder.update({
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

    // Check if incident was closed and reopen it
    if (workOrder.incident.status?.name === "CERRADO" && enProgresoStatus) {
      await tx.incident.update({
        where: { id: workOrder.incidentId },
        data: {
          statusId: enProgresoStatus.id,
          resolvedAt: null,
        },
      });
      incidentReopened = true;
      console.log(
        `[REOPEN] Incident #${workOrder.incidentId} reopened - work order #${id} reopened`,
      );
    }

    return { workOrder, incidentReopened, incidentId: workOrder.incidentId };
  });

  revalidatePath("/fsr/work-orders");
  revalidatePath(`/fsr/work-orders/${id}`);
  revalidatePath("/admin/work-orders");
  revalidatePath(`/admin/work-orders/${id}`);
  if (result.incidentReopened) {
    revalidatePath(`/admin/incidents/${result.incidentId}`);
    revalidatePath("/admin/incidents");
    revalidatePath("/client/incidents");
  }
  return {
    success: true,
    data: result.workOrder,
    incidentReopened: result.incidentReopened,
  };
}

/**
 * Get work orders assigned to current user (FSR)
 */
export async function getMyWorkOrders() {
  const user = await requirePermission("work-orders:read");

  const workOrders = await prisma.workOrder.findMany({
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
          workActivities: true,
          workParts: true,
        },
      },
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return workOrders;
}

/**
 * Get form options for work orders
 */
export async function getWorkOrderFormOptions() {
  await requirePermission("work-orders:read");

  const [incidents, users, incidentStatuses] = await Promise.all([
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
        vicIds: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.incidentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { incidents, users, incidentStatuses };
}

/**
 * Upload attachment for work order
 */
export async function uploadWorkOrderAttachment(
  workOrderId: string,
  fileData: {
    filename: string;
    base64Data: string;
    mimetype: string;
    size: number;
    description?: string;
  },
) {
  await requirePermission("work-orders:update");

  // Use new storage abstraction
  const { uploadFile } = await import("@/lib/storage/file-storage");

  // Upload file using configured storage provider
  const uploadResult = await uploadFile(
    fileData.filename,
    fileData.base64Data,
    fileData.mimetype,
    { subfolder: "work-orders" },
  );

  // Save to database
  const attachment = await prisma.workOrderAttachment.create({
    data: {
      workOrderId,
      filename: uploadResult.filename,
      filepath: uploadResult.url,
      mimetype: uploadResult.mimetype,
      size: uploadResult.size,
      description: fileData.description || null,
      provider: uploadResult.provider,
    },
  });

  revalidatePath(`/admin/work-orders/${workOrderId}`);
  revalidatePath(`/fsr/work-orders/${workOrderId}`);

  return { success: true, data: attachment };
}

/**
 * Delete work order attachment
 */
export async function deleteWorkOrderAttachment(id: string) {
  await requirePermission("work-orders:update");

  const attachment = await prisma.workOrderAttachment.findUnique({
    where: { id },
  });

  if (!attachment) {
    throw new Error("Attachment not found");
  }

  // Mark as inactive
  await prisma.workOrderAttachment.update({
    where: { id },
    data: { active: false },
  });

  // Delete physical file using storage abstraction
  try {
    const { deleteFile } = await import("@/lib/storage/file-storage");
    await deleteFile(
      attachment.filepath,
      attachment.provider as "vercel-blob" | "filesystem",
    );
  } catch (error) {
    console.error("Error deleting file:", error);
    // Continue even if file deletion fails
  }

  revalidatePath(`/admin/work-orders/${attachment.workOrderId}`);
  revalidatePath(`/fsr/work-orders/${attachment.workOrderId}`);

  return { success: true };
}

/**
 * Update work order status (FSR functionality)
 */
export async function updateWorkOrderStatus(id: string, statusId: number) {
  await requirePermission("work-orders:update");

  const workOrder = await prisma.workOrder.update({
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

  revalidatePath("/fsr/work-orders");
  revalidatePath(`/fsr/work-orders/${id}`);
  revalidatePath("/admin/work-orders");
  revalidatePath(`/admin/work-orders/${id}`);
  return { success: true, data: workOrder };
}

/**
 * Update work order folio (FSR functionality)
 */
export async function updateWorkOrderFolio(id: string, folio: string) {
  await requirePermission("work-orders:update");

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: {
      folio,
    },
    include: {
      incident: true,
      assignedTo: true,
      status: true,
    },
  });

  revalidatePath("/fsr/work-orders");
  revalidatePath(`/fsr/work-orders/${id}`);
  revalidatePath("/admin/work-orders");
  revalidatePath(`/admin/work-orders/${id}`);
  return { success: true, data: workOrder };
}
