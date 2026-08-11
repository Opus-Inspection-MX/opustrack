"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { getClienteWhereClause } from "@/lib/auth/filters";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  type WorkPartCreateInput,
  WorkPartCreateSchema,
  WorkPartUpdateSchema,
} from "@/lib/validations/parts";

// Keep legacy type for backward compatibility
export type WorkPartFormData = WorkPartCreateInput;

async function assertAssignmentEditable(
  assignmentId: string | null | undefined,
): Promise<void> {
  if (!assignmentId) return;
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
 * Get all work parts
 * Filtered by user's Cliente (except ADMINISTRADOR who sees all)
 */
export async function getAllWorkParts() {
  const user = await requirePermission("assignments:read");
  const clienteFilter = getClienteWhereClause(user);

  const workParts = await prisma.workPart.findMany({
    where: {
      active: true,
      assignment: { incident: { ...clienteFilter } },
    },
    include: {
      part: true,
      assignment: {
        include: {
          status: true,
          incident: {
            select: {
              title: true,
            },
          },
        },
      },
      activity: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return workParts;
}

/**
 * Get work parts for an assignment
 */
export async function getWorkParts(assignmentId: string) {
  await requirePermission("assignments:read");

  const workParts = await prisma.workPart.findMany({
    where: {
      assignmentId,
      active: true,
    },
    include: {
      part: true,
      activity: true,
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
  await requirePermission("assignments:update");

  const validated = WorkPartCreateSchema.parse(data);
  await assertAssignmentEditable(validated.assignmentId);

  const workPart = await prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({
      where: { id: validated.partId },
    });

    if (!part) {
      throw new Error("Parte no encontrada");
    }

    const updated = await tx.part.updateMany({
      where: { id: validated.partId, stock: { gte: validated.quantity } },
      data: { stock: { decrement: validated.quantity } },
    });

    if (updated.count === 0) {
      throw new Error(
        `Stock insuficiente. Disponible: ${part.stock}, Solicitado: ${validated.quantity}`,
      );
    }

    const wp = await tx.workPart.create({
      data: {
        assignmentId: validated.assignmentId,
        activityId: validated.activityId,
        partId: validated.partId,
        quantity: validated.quantity,
        description: validated.description || null,
        price: part.price,
      },
    });

    return wp;
  });

  if (validated.assignmentId) {
    revalidatePath(`/admin/assignments/${validated.assignmentId}`);
    revalidatePath(`/fsr/assignments/${validated.assignmentId}`);
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
  await requirePermission("assignments:update");

  // Validate before touching stock: an unchecked negative quantity would take
  // the "restore" branch below and create inventory out of nothing.
  const validated = WorkPartUpdateSchema.parse({ ...data, id });

  const existingForGuard = await prisma.workPart.findFirst({
    where: { id, active: true },
    select: { assignmentId: true },
  });
  await assertAssignmentEditable(existingForGuard?.assignmentId);

  const result = await prisma.$transaction(async (tx) => {
    // Only active rows: re-editing a soft-deleted work part would move stock
    // for a record whose quantity was already returned by deleteWorkPart.
    const existingWorkPart = await tx.workPart.findFirst({
      where: { id, active: true },
    });

    if (!existingWorkPart) {
      throw new Error("Work part no encontrada");
    }

    if (
      validated.quantity !== undefined &&
      validated.quantity !== existingWorkPart.quantity
    ) {
      const difference = validated.quantity - existingWorkPart.quantity;

      if (difference > 0) {
        const updated = await tx.part.updateMany({
          where: {
            id: existingWorkPart.partId,
            stock: { gte: difference },
          },
          data: { stock: { decrement: difference } },
        });

        if (updated.count === 0) {
          const part = await tx.part.findUnique({
            where: { id: existingWorkPart.partId },
          });
          throw new Error(
            `Stock insuficiente. Disponible: ${part?.stock ?? 0}, Solicitado adicional: ${difference}`,
          );
        }
      } else {
        await tx.part.update({
          where: { id: existingWorkPart.partId },
          data: { stock: { increment: Math.abs(difference) } },
        });
      }
    }

    const workPart = await tx.workPart.update({
      where: { id },
      data: {
        quantity: validated.quantity,
        description: validated.description,
      },
    });

    return { workPart, assignmentId: existingWorkPart.assignmentId };
  });

  if (result.assignmentId) {
    revalidatePath(`/admin/assignments/${result.assignmentId}`);
    revalidatePath(`/fsr/assignments/${result.assignmentId}`);
  }

  return { success: true, data: result.workPart };
}

/**
 * Delete work part
 * Uses transaction to ensure atomicity when restoring stock and soft deleting
 */
export async function deleteWorkPart(id: string) {
  await requirePermission("assignments:delete");

  const existingForGuard = await prisma.workPart.findFirst({
    where: { id, active: true },
    select: { assignmentId: true },
  });
  await assertAssignmentEditable(existingForGuard?.assignmentId);

  const result = await prisma.$transaction(async (tx) => {
    const workPart = await tx.workPart.findFirst({
      where: { id, active: true },
    });

    if (!workPart) {
      throw new Error("Work part no encontrada");
    }

    // Deactivate first, conditioned on the row still being active. If a
    // concurrent delete won the race, count is 0 and the stock is not returned
    // twice for the same work part.
    const deactivated = await tx.workPart.updateMany({
      where: { id, active: true },
      data: { active: false },
    });

    if (deactivated.count === 0) {
      throw new Error("Work part no encontrada");
    }

    await tx.part.update({
      where: { id: workPart.partId },
      data: { stock: { increment: workPart.quantity } },
    });

    return { assignmentId: workPart.assignmentId };
  });

  if (result.assignmentId) {
    revalidatePath(`/admin/assignments/${result.assignmentId}`);
    revalidatePath(`/fsr/assignments/${result.assignmentId}`);
  }

  return { success: true };
}

/**
 * Get work part by ID
 */
export async function getWorkPartById(id: string) {
  await requirePermission("assignments:read");

  const workPart = await prisma.workPart.findUnique({
    where: { id },
    include: {
      part: true,
      assignment: {
        include: {
          status: true,
          incident: true,
          assignees: {
            where: { active: true },
            include: { user: true },
          },
        },
      },
      activity: true,
    },
  });

  return workPart;
}

/**
 * Get parts available for assignment (for FSR).
 *
 * Parts are not scoped per Cliente: the `Part` model has no `clienteId` column,
 * so there is nothing to filter by. The parameter this function used to accept
 * produced an invalid Prisma query at runtime and has been removed — reinstate
 * it only together with the schema migration.
 */
export async function getAvailableParts() {
  await requirePermission("parts:read");

  const parts = await prisma.part.findMany({
    where: {
      active: true,
      stock: { gt: 0 },
    },
    orderBy: { name: "asc" },
  });

  return parts;
}
