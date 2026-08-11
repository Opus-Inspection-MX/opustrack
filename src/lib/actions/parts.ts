"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { rejected } from "./result";

export type PartFormData = {
  name: string;
  description?: string;
  price: number;
  stock: number;
};

export type GetPartsParams = {
  page?: number;
  limit?: number;
  search?: string;
};

/**
 * Get paginated parts list for catalog screen.
 * Supports server-side search by name and description.
 */
export async function getParts(params?: GetPartsParams) {
  await requirePermission("parts:read");

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const search = params?.search?.trim();
  const skip = (page - 1) * limit;

  const where = {
    active: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.part.findMany({
      where,
      include: {
        _count: {
          select: { workParts: true },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.part.count({ where }),
  ]);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get all active parts as a flat array — for use in form selectors / dropdowns.
 * Does NOT paginate; returns the full list sorted by name.
 */
export async function getPartsForSelect() {
  await requirePermission("parts:read");

  return prisma.part.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
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
    return rejected(
      `No se puede eliminar: la refacción se usa en ${workPartCount} registro(s) activo(s).`,
    );
  }

  await prisma.part.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/parts");
  return { success: true };
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
