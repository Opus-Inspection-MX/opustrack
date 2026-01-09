"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/database/prisma.singleton";

export async function getLines() {
  try {
    const lines = await prisma.line.findMany({
      where: { active: true },
      include: {
        vic: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        equipments: {
          where: { active: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return lines;
  } catch (error) {
    console.error("Error fetching lines:", error);
    throw new Error("Failed to fetch lines");
  }
}

export async function getLineById(id: number) {
  try {
    const line = await prisma.line.findUnique({
      where: { id },
      include: {
        vic: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        equipments: {
          where: { active: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!line) {
      throw new Error("Line not found");
    }

    return line;
  } catch (error) {
    console.error("Error fetching line:", error);
    throw error;
  }
}

export async function getLinesByVicId(vicId: string) {
  try {
    const lines = await prisma.line.findMany({
      where: {
        vicId,
        active: true,
      },
      include: {
        equipments: {
          where: { active: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return lines;
  } catch (error) {
    console.error("Error fetching lines by VIC:", error);
    throw new Error("Failed to fetch lines");
  }
}

export async function createLine(data: {
  name: string;
  description?: string;
  vicId: string;
}) {
  try {
    const line = await prisma.line.create({
      data: {
        name: data.name,
        description: data.description,
        vicId: data.vicId,
      },
      include: {
        vic: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    revalidatePath("/admin/lines");
    return { success: true, line };
  } catch (error) {
    console.error("Error creating line:", error);
    throw new Error("Failed to create line");
  }
}

export async function updateLine(
  id: number,
  data: {
    name?: string;
    description?: string;
    vicId?: string;
  },
) {
  try {
    const line = await prisma.line.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.vicId && { vicId: data.vicId }),
      },
      include: {
        vic: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    revalidatePath("/admin/lines");
    revalidatePath(`/admin/lines/${id}`);
    return { success: true, line };
  } catch (error) {
    console.error("Error updating line:", error);
    throw new Error("Failed to update line");
  }
}

export async function deleteLine(id: number) {
  try {
    // Soft delete - set active to false
    await prisma.line.update({
      where: { id },
      data: { active: false },
    });

    revalidatePath("/admin/lines");
    return { success: true };
  } catch (error) {
    console.error("Error deleting line:", error);
    throw new Error("Failed to delete line");
  }
}

export async function toggleLineStatus(id: number) {
  try {
    const line = await prisma.line.findUnique({
      where: { id },
      select: { active: true },
    });

    if (!line) {
      throw new Error("Line not found");
    }

    const updatedLine = await prisma.line.update({
      where: { id },
      data: { active: !line.active },
    });

    revalidatePath("/admin/lines");
    return { success: true, line: updatedLine };
  } catch (error) {
    console.error("Error toggling line status:", error);
    throw new Error("Failed to toggle line status");
  }
}
