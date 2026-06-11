"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

export type PartFormData = {
  name: string;
  description?: string;
  price: number;
  stock: number;
};

/**
 * Get all parts (warehouse-level, not scoped to Cliente)
 */
export async function getParts() {
  await requirePermission("parts:read");

  const parts = await prisma.part.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { workParts: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return parts;
}

/**
 * Get single part by ID
 */
export async function getPartById(id: string) {
  await requirePermission("parts:read");

  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      workParts: {
        where: { active: true },
        include: {
          assignment: {
            include: {
              incident: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  return part;
}

/**
 * Create new part
 */
export async function createPart(data: PartFormData) {
  await requirePermission("parts:create");

  const part = await prisma.part.create({
    data: {
      name: data.name,
      description: data.description || null,
      price: data.price,
      stock: data.stock,
    },
  });

  revalidatePath("/admin/parts");
  return { success: true, data: part };
}

/**
 * Update existing part
 */
export async function updatePart(id: string, data: PartFormData) {
  await requirePermission("parts:update");

  const part = await prisma.part.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      price: data.price,
      stock: data.stock,
    },
  });

  revalidatePath("/admin/parts");
  revalidatePath(`/admin/parts/${id}`);
  return { success: true, data: part };
}

/**
 * Delete part (soft delete)
 */
export async function deletePart(id: string) {
  await requirePermission("parts:delete");

  // Prevent removing a part that is still referenced by active work parts,
  // which would leave those usage records pointing at a "deleted" part.
  const workPartCount = await prisma.workPart.count({
    where: { partId: id, active: true },
  });

  if (workPartCount > 0) {
    throw new Error(
      `Cannot delete part. It is used in ${workPartCount} active work part record(s).`,
    );
  }

  await prisma.part.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/parts");
  redirect("/admin/parts");
}

/**
 * Update part stock
 */
export async function updatePartStock(id: string, quantity: number) {
  await requirePermission("parts:update");

  const part = await prisma.part.update({
    where: { id },
    data: {
      stock: {
        increment: quantity,
      },
    },
  });

  revalidatePath("/admin/parts");
  revalidatePath(`/admin/parts/${id}`);
  return { success: true, data: part };
}
