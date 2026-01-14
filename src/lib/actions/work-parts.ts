"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  type WorkPartCreateInput,
  WorkPartCreateSchema,
} from "@/lib/validations/parts";

// Keep legacy type for backward compatibility
export type WorkPartFormData = WorkPartCreateInput;

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
          status: true,
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
 * Uses transaction to ensure atomicity between creating work part and decrementing stock
 * Validates input with Zod schema
 */
export async function createWorkPart(data: unknown) {
  await requirePermission("work-orders:update");

  // Validate input
  const validated = WorkPartCreateSchema.parse(data);

  // Use transaction to ensure stock integrity
  const workPart = await prisma.$transaction(async (tx) => {
    // Check part stock within transaction to prevent race conditions
    const part = await tx.part.findUnique({
      where: { id: validated.partId },
    });

    if (!part) {
      throw new Error("Parte no encontrada");
    }

    if (part.stock < validated.quantity) {
      throw new Error(`Stock insuficiente. Disponible: ${part.stock}`);
    }

    // Create work part
    const wp = await tx.workPart.create({
      data: {
        workOrderId: validated.workOrderId,
        workActivityId: validated.workActivityId,
        partId: validated.partId,
        quantity: validated.quantity,
        description: validated.description || null,
        price: part.price, // Store the price at time of use
      },
    });

    // Update part stock
    await tx.part.update({
      where: { id: validated.partId },
      data: { stock: { decrement: validated.quantity } },
    });

    return wp;
  });

  if (validated.workOrderId) {
    revalidatePath(`/admin/work-orders/${validated.workOrderId}`);
    revalidatePath(`/fsr/work-orders/${validated.workOrderId}`);
  }

  return { success: true, data: workPart };
}

/**
 * Update work part
 * Uses transaction to ensure atomicity when updating quantity and adjusting stock
 */
export async function updateWorkPart(
  id: string,
  data: Partial<WorkPartFormData>,
) {
  await requirePermission("work-orders:update");

  // Use transaction to ensure stock integrity
  const result = await prisma.$transaction(async (tx) => {
    const existingWorkPart = await tx.workPart.findUnique({
      where: { id },
    });

    if (!existingWorkPart) {
      throw new Error("Work part no encontrada");
    }

    // If quantity changed, update stock
    if (data.quantity && data.quantity !== existingWorkPart.quantity) {
      const difference = data.quantity - existingWorkPart.quantity;

      const part = await tx.part.findUnique({
        where: { id: existingWorkPart.partId },
      });

      if (!part) {
        throw new Error("Parte no encontrada");
      }

      if (difference > 0 && part.stock < difference) {
        throw new Error(`Stock insuficiente. Disponible: ${part.stock}`);
      }

      await tx.part.update({
        where: { id: existingWorkPart.partId },
        data: { stock: { decrement: difference } },
      });
    }

    const workPart = await tx.workPart.update({
      where: { id },
      data: {
        quantity: data.quantity,
        description: data.description,
      },
    });

    return { workPart, workOrderId: existingWorkPart.workOrderId };
  });

  if (result.workOrderId) {
    revalidatePath(`/admin/work-orders/${result.workOrderId}`);
    revalidatePath(`/fsr/work-orders/${result.workOrderId}`);
  }

  return { success: true, data: result.workPart };
}

/**
 * Delete work part
 * Uses transaction to ensure atomicity when restoring stock and soft deleting
 */
export async function deleteWorkPart(id: string) {
  await requirePermission("work-orders:delete");

  // Use transaction to ensure stock integrity
  const result = await prisma.$transaction(async (tx) => {
    const workPart = await tx.workPart.findUnique({
      where: { id },
    });

    if (!workPart) {
      throw new Error("Work part no encontrada");
    }

    // Restore stock
    await tx.part.update({
      where: { id: workPart.partId },
      data: { stock: { increment: workPart.quantity } },
    });

    // Soft delete
    await tx.workPart.update({
      where: { id },
      data: { active: false },
    });

    return { workOrderId: workPart.workOrderId };
  });

  if (result.workOrderId) {
    revalidatePath(`/admin/work-orders/${result.workOrderId}`);
    revalidatePath(`/fsr/work-orders/${result.workOrderId}`);
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
          status: true,
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
