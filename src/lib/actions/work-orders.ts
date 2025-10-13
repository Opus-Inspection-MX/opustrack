"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type WorkOrderFormData = {
  incidentId: number;
  assignedToId: string;
  status: string;
  notes?: string;
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
      status: data.status,
      notes: data.notes || null,
      startedAt: data.startedAt || null,
      finishedAt: data.finishedAt || null,
    },
    include: {
      incident: true,
      assignedTo: true,
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
      status: data.status,
      notes: data.notes || null,
      startedAt: data.startedAt || null,
      finishedAt: data.finishedAt || null,
    },
    include: {
      incident: true,
      assignedTo: true,
    },
  });

  revalidatePath("/admin/work-orders");
  revalidatePath(`/admin/work-orders/${id}`);
  revalidatePath(`/admin/incidents/${workOrder.incidentId}`);
  return { success: true, data: workOrder };
}

/**
 * Delete work order (soft delete)
 */
export async function deleteWorkOrder(id: string) {
  await requirePermission("work-orders:delete");

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    select: { incidentId: true },
  });

  await prisma.workOrder.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/work-orders");
  if (workOrder) {
    revalidatePath(`/admin/incidents/${workOrder.incidentId}`);
  }
  redirect("/admin/work-orders");
}

/**
 * Complete work order (FSR functionality)
 */
export async function completeWorkOrder(id: string, notes?: string) {
  await requirePermission("work-orders:complete");

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: {
      status: "COMPLETADA",
      finishedAt: new Date(),
      notes: notes || null,
    },
    include: {
      incident: true,
      assignedTo: true,
    },
  });

  // Update incident status to CERRADO if all work orders are completed
  const incidentWorkOrders = await prisma.workOrder.findMany({
    where: {
      incidentId: workOrder.incidentId,
      active: true,
    },
  });

  const allCompleted = incidentWorkOrders.every((wo) => wo.status === "COMPLETADA");

  if (allCompleted) {
    const closedStatus = await prisma.incidentStatus.findFirst({
      where: { name: "CERRADO" },
    });

    if (closedStatus) {
      await prisma.incident.update({
        where: { id: workOrder.incidentId },
        data: {
          statusId: closedStatus.id,
          resolvedAt: new Date(),
        },
      });
    }
  }

  revalidatePath("/fsr/work-orders");
  revalidatePath(`/fsr/work-orders/${id}`);
  revalidatePath("/admin/work-orders");
  revalidatePath(`/admin/work-orders/${id}`);
  return { success: true, data: workOrder };
}

/**
 * Start work order (FSR functionality)
 */
export async function startWorkOrder(id: string) {
  await requirePermission("work-orders:update");

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: {
      status: "EN_PROGRESO",
      startedAt: new Date(),
    },
    include: {
      incident: true,
      assignedTo: true,
    },
  });

  revalidatePath("/fsr/work-orders");
  revalidatePath(`/fsr/work-orders/${id}`);
  revalidatePath("/admin/work-orders");
  return { success: true, data: workOrder };
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

  const [incidents, users] = await Promise.all([
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
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return { incidents, users };
}
