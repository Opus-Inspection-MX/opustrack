"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/database/prisma.singleton";

export async function getEquipments() {
  try {
    const equipments = await prisma.equipment.findMany({
      where: { active: true },
      include: {
        line: {
          include: {
            vic: {
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
    });

    // Serialize dates for client components
    return equipments.map((equipment) => ({
      ...equipment,
      createdAt: equipment.createdAt.toISOString(),
      updatedAt: equipment.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching equipments:", error);
    throw new Error("Failed to fetch equipments");
  }
}

export async function getEquipmentById(id: number) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        line: {
          include: {
            vic: {
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
            vic: {
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
            vic: {
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
