"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { businessRule, guarded } from "./result";

/**
 * Parts and equipment used on an assignment, as a free-text list.
 *
 * There is no catalogue behind `name` on purpose: pointing at a parts table
 * with stock means running a warehouse, and what the work actually needs
 * recorded is what was used, how many, and what each cost.
 */

/**
 * Refuse changes once the incident is closed or cancelled.
 *
 * The same gate `assignment-activities.ts` applies, and for the same reason:
 * the work record of a finished incident is what gets billed and audited, so it
 * must stop moving. Without this an FSR could keep adding costed lines to work
 * that was already signed off.
 */
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

export type AssignmentItemInput = {
  assignmentId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export async function getAssignmentItems(assignmentId: string) {
  await requirePermission("assignments:read");

  return prisma.assignmentItem.findMany({
    where: { assignmentId, active: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAssignmentItem(data: AssignmentItemInput) {
  await requirePermission("assignments:update");

  return guarded(async () => {
    await assertAssignmentEditable(data.assignmentId);

    const name = data.name?.trim();
    if (!name) {
      businessRule("Escribe el nombre de la refacción o equipo.");
    }
    if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
      businessRule("La cantidad debe ser mayor que cero.");
    }
    if (!Number.isFinite(data.unitPrice) || data.unitPrice < 0) {
      businessRule("El precio unitario no puede ser negativo.");
    }

    const item = await prisma.assignmentItem.create({
      data: {
        assignmentId: data.assignmentId,
        name,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
      },
    });

    revalidatePath(`/fsr/assignments/${data.assignmentId}`);
    revalidatePath(`/admin/assignments/${data.assignmentId}`);
    return { data: item };
  });
}

export async function deleteAssignmentItem(id: string) {
  await requirePermission("assignments:update");

  return guarded(async () => {
    const existing = await prisma.assignmentItem.findUnique({
      where: { id },
      select: { assignmentId: true },
    });
    if (!existing) {
      businessRule("La refacción ya no existe.");
    }
    await assertAssignmentEditable(existing.assignmentId);

    // Soft delete, like every other record here: the list is part of the work
    // record and removing a line should not erase that it was ever there.
    const item = await prisma.assignmentItem.update({
      where: { id },
      data: { active: false },
      select: { assignmentId: true },
    });

    revalidatePath(`/fsr/assignments/${item.assignmentId}`);
    revalidatePath(`/admin/assignments/${item.assignmentId}`);
    return { data: null };
  });
}
