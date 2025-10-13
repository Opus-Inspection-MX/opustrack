"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type PartFormData = {
  name: string;
  description?: string;
  price: number;
  stock: number;
  vicId: string;
};

/**
 * Get all parts
 */
export async function getParts() {
  await requirePermission("parts:read");

  const parts = await prisma.part.findMany({
    where: { active: true },
    include: {
      vic: true,
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
      vic: true,
      workParts: {
        where: { active: true },
        include: {
          workOrder: {
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
      vicId: data.vicId,
    },
    include: {
      vic: true,
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
      vicId: data.vicId,
    },
    include: {
      vic: true,
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

/**
 * Get VICs for part form
 */
export async function getVICsForParts() {
  await requirePermission("parts:read");

  const vics = await prisma.vehicleInspectionCenter.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return vics;
}
