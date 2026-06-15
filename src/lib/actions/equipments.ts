"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

export async function getEquipments(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  await requirePermission("equipments:read");

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.EquipmentWhereInput = { active: true };
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  try {
    const [equipments, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: {
          line: {
            include: {
              cliente: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.equipment.count({ where }),
    ]);

    const data = equipments.map((equipment) => ({
      ...equipment,
      createdAt: equipment.createdAt.toISOString(),
      updatedAt: equipment.updatedAt.toISOString(),
    }));

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error fetching equipments:", error);
    throw new Error("Failed to fetch equipments");
  }
}

export async function getEquipmentById(id: number) {
  await requirePermission("equipments:read");
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        line: {
          include: {
            cliente: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!equipment) {
      throw new Error("Equipment not found");
    }

    return equipment;
  } catch (error) {
    console.error("Error fetching equipment:", error);
    throw error;
  }
}

export async function getEquipmentsByLineId(lineId: number) {
  await requirePermission("equipments:read");
  try {
    const equipments = await prisma.equipment.findMany({
      where: {
        lineId,
        active: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return equipments;
  } catch (error) {
    console.error("Error fetching equipments by line:", error);
    throw new Error("Failed to fetch equipments");
  }
}

export async function createEquipment(data: {
  name: string;
  description?: string;
  lineId: number;
}) {
  await requirePermission("equipments:create");
  try {
    const equipment = await prisma.equipment.create({
      data: {
        name: data.name,
        description: data.description,
        lineId: data.lineId,
      },
      include: {
        line: {
          include: {
            cliente: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/admin/equipments");
    revalidatePath(`/admin/lines/${data.lineId}`);
    return { success: true, equipment };
  } catch (error) {
    console.error("Error creating equipment:", error);
    throw new Error("Failed to create equipment");
  }
}

export async function updateEquipment(
  id: number,
  data: {
    name?: string;
    description?: string;
    lineId?: number;
  },
) {
  await requirePermission("equipments:update");
  try {
    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.lineId && { lineId: data.lineId }),
      },
      include: {
        line: {
          include: {
            cliente: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/admin/equipments");
    revalidatePath(`/admin/equipments/${id}`);
    if (data.lineId) {
      revalidatePath(`/admin/lines/${data.lineId}`);
    }
    return { success: true, equipment };
  } catch (error) {
    console.error("Error updating equipment:", error);
    throw new Error("Failed to update equipment");
  }
}

export async function deleteEquipment(id: number) {
  await requirePermission("equipments:delete");
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: { lineId: true },
    });

    // Soft delete - set active to false
    await prisma.equipment.update({
      where: { id },
      data: { active: false },
    });

    revalidatePath("/admin/equipments");
    if (equipment) {
      revalidatePath(`/admin/lines/${equipment.lineId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error deleting equipment:", error);
    throw new Error("Failed to delete equipment");
  }
}

export async function toggleEquipmentStatus(id: number) {
  await requirePermission("equipments:update");
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: { active: true },
    });

    if (!equipment) {
      throw new Error("Equipment not found");
    }

    const updatedEquipment = await prisma.equipment.update({
      where: { id },
      data: { active: !equipment.active },
    });

    revalidatePath("/admin/equipments");
    return { success: true, equipment: updatedEquipment };
  } catch (error) {
    console.error("Error toggling equipment status:", error);
    throw new Error("Failed to toggle equipment status");
  }
}
