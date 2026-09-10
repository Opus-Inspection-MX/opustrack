"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { guarded, ok, rejected } from "./result";

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

  // Reads throw defects naturally (see lines.ts): no generic wrap.
  const [equipments, total] = await Promise.all([
    prisma.equipment.findMany({
      where,
      include: {
        line: {
          include: {
            client: {
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
}

export async function getEquipmentById(id: number) {
  await requirePermission("equipments:read");
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      line: {
        include: {
          client: {
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
}

export async function getEquipmentsByLineId(lineId: number) {
  await requirePermission("equipments:read");
  const equipments = await prisma.equipment.findMany({
    where: {
      lineId,
      active: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return equipments;
}

export async function createEquipment(data: {
  name: string;
  description?: string;
  lineId: number;
}) {
  await requirePermission("equipments:create");
  return guarded(async () => {
    const equipment = await prisma.equipment.create({
      data: {
        name: data.name,
        description: data.description,
        lineId: data.lineId,
      },
      include: {
        line: {
          include: {
            client: {
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
    return ok({ equipment });
  });
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
  return guarded(async () => {
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
            client: {
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
    return ok({ equipment });
  });
}

export async function deleteEquipment(id: number) {
  await requirePermission("equipments:delete");

  // Prevent orphaning: an incident points at the equipment it was reported for,
  // and nothing re-validates that relation afterwards. Every other catalog
  // delete guards its children the same way — this one used to be the exception.
  const incidentCount = await prisma.incident.count({
    where: { equipmentId: id, active: true },
  });

  if (incidentCount > 0) {
    return rejected(
      `No se puede eliminar: ${incidentCount} incidente(s) activo(s) lo referencian.`,
    );
  }

  return guarded(async () => {
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
    return ok();
  });
}

export async function toggleEquipmentStatus(id: number) {
  await requirePermission("equipments:update");
  return guarded(async () => {
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
    return ok({ equipment: updatedEquipment });
  });
}
