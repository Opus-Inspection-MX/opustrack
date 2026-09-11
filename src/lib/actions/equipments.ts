"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { loadEquipmentFor, loadLineFor, requireClientAccess } from "@/lib/auth/access";
import { getReportScope } from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";
import { guarded, ok, rejected } from "./result";

export async function getEquipments(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const user = await requirePermission("equipments:read");
  const scope = await getReportScope(user);

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const skip = (page - 1) * limit;

  // Scoped through the parent line (H-03): equipment reaches its Client via
  // `line.clientId`.
  const where: Prisma.EquipmentWhereInput = {
    active: true,
    ...(scope.clientIds === null
      ? {}
      : { line: { clientId: { in: scope.clientIds } } }),
  };
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
  const user = await requirePermission("equipments:read");
  // Reader gate: active equipment whose line's Client is in scope (H-03).
  await loadEquipmentFor(user, id);
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
  const user = await requirePermission("equipments:read");
  // The parent line itself must be visible (H-03).
  await loadLineFor(user, lineId);
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
  const user = await requirePermission("equipments:create");
  return guarded(async () => {
    // Equipment is born inside a line: the line must be visible (H-04).
    await loadLineFor(user, data.lineId);
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
  const user = await requirePermission("equipments:update");
  return guarded(async () => {
    // The current row must be visible, and the destination line too:
    // moving equipment re-homes it to another line's Client (H-04).
    await loadEquipmentFor(user, id);
    if (data.lineId) {
      await loadLineFor(user, data.lineId);
    }
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
  const user = await requirePermission("equipments:delete");

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
    // In scope and still active (H-04, H-17).
    const equipment = await loadEquipmentFor(user, id);
    const lineId = equipment.lineId;

    // Soft delete - set active to false
    await prisma.equipment.update({
      where: { id },
      data: { active: false },
    });

    revalidatePath("/admin/equipments");
    revalidatePath(`/admin/lines/${lineId}`);
    return ok();
  });
}

export async function toggleEquipmentStatus(id: number) {
  const user = await requirePermission("equipments:update");
  return guarded(async () => {
    // Scope without the active gate: toggling is also how equipment is
    // RE-activated, so the loader's active:true would brick that flow.
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: { active: true, line: { select: { clientId: true } } },
    });

    if (!equipment) {
      throw new Error("Equipment not found");
    }
    await requireClientAccess(user, equipment.line.clientId);

    const updatedEquipment = await prisma.equipment.update({
      where: { id },
      data: { active: !equipment.active },
    });

    revalidatePath("/admin/equipments");
    return ok({ equipment: updatedEquipment });
  });
}
