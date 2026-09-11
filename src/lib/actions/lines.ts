"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { loadLineFor, requireClientAccess } from "@/lib/auth/access";
import { requirePermission } from "@/lib/auth/auth";
import { getReportScope } from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";
import { guarded, ok, rejected } from "./result";

export async function getLines(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const user = await requirePermission("lines:read");
  const scope = await getReportScope(user);

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const skip = (page - 1) * limit;

  // Scoped to the caller's Clients (H-03): lines belong to exactly one
  // Client, so the filter is a direct `clientId` constraint.
  const where: Prisma.LineWhereInput = {
    active: true,
    ...(scope.clientIds === null ? {} : { clientId: { in: scope.clientIds } }),
  };
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  // Reads throw defects naturally: wrapping a query fault in a generic
  // `Failed to fetch` destroyed the original stack while telling the operator
  // nothing actionable. Unexpected faults still throw — only business rules
  // are returned, and reads have none.
  const [lines, total] = await Promise.all([
    prisma.line.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        equipments: {
          where: { active: true },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.line.count({ where }),
  ]);

  const data = lines.map((line) => ({
    ...line,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
    equipments: line.equipments,
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

export async function getLineById(id: number) {
  const user = await requirePermission("lines:read");
  // Reader gate: active line whose Client is in scope (H-03).
  await loadLineFor(user, id);
  const line = await prisma.line.findUnique({
    where: { id },
    include: {
      client: {
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
    // Defect, not a rule: the UI only offers existing lines, so a miss means
    // a stale link or a race — it keeps throwing in English like before.
    throw new Error("Line not found");
  }

  return line;
}

export async function getLinesByClientId(clientId: string) {
  const user = await requirePermission("lines:read");
  // The requested Client itself must be in scope (H-03).
  await requireClientAccess(user, clientId);
  const lines = await prisma.line.findMany({
    where: {
      clientId,
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
}

export async function createLine(data: {
  name: string;
  description?: string;
  clientId: string;
}) {
  const user = await requirePermission("lines:create");
  return guarded(async () => {
    // A line can only be born inside a Client the caller may see (H-04).
    await requireClientAccess(user, data.clientId);
    const line = await prisma.line.create({
      data: {
        name: data.name,
        description: data.description,
        clientId: data.clientId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    revalidatePath("/admin/lines");
    return ok({ line });
  });
}

export async function updateLine(
  id: number,
  data: {
    name?: string;
    description?: string;
    clientId?: string;
  },
) {
  const user = await requirePermission("lines:update");
  return guarded(async () => {
    // The current line must be visible, and the destination Client too:
    // moving a line silently re-homes its equipment (H-04).
    await loadLineFor(user, id);
    if (data.clientId) {
      await requireClientAccess(user, data.clientId);
    }
    const line = await prisma.line.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.clientId && { clientId: data.clientId }),
      },
      include: {
        client: {
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
    return ok({ line });
  });
}

export async function deleteLine(id: number) {
  const user = await requirePermission("lines:delete");

  // Prevent orphaning child equipment: a line cannot be removed while it still
  // has active equipment attached.
  const equipmentCount = await prisma.equipment.count({
    where: { lineId: id, active: true },
  });

  if (equipmentCount > 0) {
    return rejected(
      `No se puede eliminar: ${equipmentCount} equipo(s) activo(s) pertenecen a esta línea.`,
    );
  }

  return guarded(async () => {
    // In scope and still active (H-04, H-17).
    await loadLineFor(user, id);
    // Soft delete - set active to false
    await prisma.line.update({
      where: { id },
      data: { active: false },
    });

    revalidatePath("/admin/lines");
    return ok();
  });
}

export async function toggleLineStatus(id: number) {
  const user = await requirePermission("lines:update");
  return guarded(async () => {
    // Scope without the active gate: toggling is also how a line is
    // RE-activated, so the loader's active:true would brick that flow.
    const line = await prisma.line.findUnique({
      where: { id },
      select: { active: true, clientId: true },
    });

    if (!line) {
      throw new Error("Line not found");
    }
    await requireClientAccess(user, line.clientId);

    const updatedLine = await prisma.line.update({
      where: { id },
      data: { active: !line.active },
    });

    revalidatePath("/admin/lines");
    return ok({ line: updatedLine });
  });
}
