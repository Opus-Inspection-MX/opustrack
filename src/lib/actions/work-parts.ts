"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

export type WorkPartFormData = {
  workOrderId?: string;
  workActivityId?: string;
  partId: string;
  quantity: number;
  description?: string;
};

/**
 * Get all work parts (admin view)
 */
export async function getAllWorkParts() {
  await requirePermission("work-orders:read");

  const workParts = await prisma.workPart.findMany({
    where: {
      active: true,
    },
    include: {
      part: true,
      workOrder: {
        include: {
          incident: {
            select: {
              title: true,
            },
          },
        },
      },
      workActivity: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return workParts;
}

/**
 * Get work parts for a work order
 */
export async function getWorkParts(workOrderId: string) {
  await requirePermission("work-orders:read");

  const workParts = await prisma.workPart.findMany({
    where: {
      workOrderId,
      active: true,
    },
    include: {
      part: true,
      workActivity: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return workParts;
}

/**
 * Create new work part
 */
export async function createWorkPart(data: WorkPartFormData) {
  await requirePermission("work-orders:update");

  // Check part stock
  const part = await prisma.part.findUnique({
    where: { id: data.partId },
  });

  if (!part) {
    throw new Error("Parte no encontrada");
  }

  if (part.stock < data.quantity) {
    throw new Error(`Stock insuficiente. Disponible: ${part.stock}`);
  }

  // Create work part and update stock
  const workPart = await prisma.workPart.create({
    data: {
      workOrderId: data.workOrderId,
      workActivityId: data.workActivityId,
      partId: data.partId,
      quantity: data.quantity,
      description: data.description || null,
      price: part.price, // Store the price at time of use
    },
  });

  // Update part stock
  await prisma.part.update({
    where: { id: data.partId },
    data: { stock: { decrement: data.quantity } },
  });

  if (data.workOrderId) {
    revalidatePath(`/admin/work-orders/${data.workOrderId}`);
    revalidatePath(`/fsr/work-orders/${data.workOrderId}`);
  }

  return { success: true, data: workPart };
}

/**
 * Update work part
 */
export async function updateWorkPart(
  id: string,
  data: Partial<WorkPartFormData>
) {
  await requirePermission("work-orders:update");

  const existingWorkPart = await prisma.workPart.findUnique({
    where: { id },
  });

  if (!existingWorkPart) {
    throw new Error("Work part no encontrada");
  }

  // If quantity changed, update stock
  if (data.quantity && data.quantity !== existingWorkPart.quantity) {
    const difference = data.quantity - existingWorkPart.quantity;

    const part = await prisma.part.findUnique({
      where: { id: existingWorkPart.partId },
    });

    if (!part) {
      throw new Error("Parte no encontrada");
    }

    if (difference > 0 && part.stock < difference) {
      throw new Error(`Stock insuficiente. Disponible: ${part.stock}`);
    }

    await prisma.part.update({
      where: { id: existingWorkPart.partId },
      data: { stock: { decrement: difference } },
    });
  }

  const workPart = await prisma.workPart.update({
    where: { id },
    data: {
      quantity: data.quantity,
      description: data.description,
    },
  });

  if (existingWorkPart.workOrderId) {
    revalidatePath(`/admin/work-orders/${existingWorkPart.workOrderId}`);
    revalidatePath(`/fsr/work-orders/${existingWorkPart.workOrderId}`);
  }

  return { success: true, data: workPart };
}

/**
 * Delete work part
 */
export async function deleteWorkPart(id: string) {
  await requirePermission("work-orders:delete");

  const workPart = await prisma.workPart.findUnique({
    where: { id },
  });

  if (!workPart) {
    throw new Error("Work part no encontrada");
  }

  // Restore stock
  await prisma.part.update({
    where: { id: workPart.partId },
    data: { stock: { increment: workPart.quantity } },
  });

  // Soft delete
  await prisma.workPart.update({
    where: { id },
    data: { active: false },
  });

  if (workPart.workOrderId) {
    revalidatePath(`/admin/work-orders/${workPart.workOrderId}`);
    revalidatePath(`/fsr/work-orders/${workPart.workOrderId}`);
  }

  return { success: true };
}

/**
 * Get work part by ID
 */
export async function getWorkPartById(id: string) {
  await requirePermission("work-orders:read");

  const workPart = await prisma.workPart.findUnique({
    where: { id },
    include: {
      part: true,
      workOrder: {
        include: {
          incident: true,
          assignedTo: true,
        },
      },
      workActivity: true,
    },
  });

  return workPart;
}

/**
 * Get parts available for work order (for FSR)
 */
export async function getAvailableParts(vicId?: string) {
  await requirePermission("parts:read");

  const parts = await prisma.part.findMany({
    where: {
      active: true,
      ...(vicId && { vicId }),
      stock: { gt: 0 }, // Only show parts with stock
    },
    orderBy: { name: "asc" },
  });

  return parts;
}
