"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { includeRoles, whereHasRole } from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import { assignUserToCliente } from "@/lib/utils/cliente-assignments";
import { rejected } from "./result";

export type ClienteFormData = {
  code: string;
  name: string;
  address?: string;
  rfc?: string;
  companyName?: string;
  phone?: string;
  contact?: string;
  email?: string;
  stateId: number;
  fsrIds?: string[];
  clientIds?: string[];
};

type GetClientesParams = {
  page?: number;
  limit?: number;
  search?: string;
};

/**
 * Lightweight Cliente list for select/dropdown inputs and filters.
 * Returns only { id, code, name, stateId } for all active Clientes — no counts,
 * no pagination. Use this instead of getClientes() when you just need options.
 * `stateId` lets callers narrow the options by plaza without a round-trip.
 */
export async function getClientesForSelect() {
  await requirePermission("clientes:read");

  return prisma.cliente.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true, stateId: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Get Clientes with relations, paginated and searchable (code, name, company).
 */
export async function getClientes(params?: GetClientesParams) {
  await requirePermission("clientes:read");

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const skip = (page - 1) * limit;
  const search = params?.search?.trim();

  const where: Prisma.ClienteWhereInput = search
    ? {
        active: true,
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { companyName: { contains: search, mode: "insensitive" } },
        ],
      }
    : { active: true };

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      include: {
        state: true,
        lines: {
          where: { active: true },
          select: {
            id: true,
            _count: { select: { equipments: true } },
          },
        },
        _count: {
          select: { users: true, incidents: true, lines: true },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.cliente.count({ where }),
  ]);

  // Count active FSRs for THIS page's Clientes in a single grouped query
  // (avoids an N+1: previously one user.count() per Cliente). Unique
  // (userId, clienteId) means row count == distinct FSR count.
  const fsrRole = await prisma.role.findFirst({ where: { name: "FSR" } });
  const fsrCountByCliente = new Map<string, number>();
  if (fsrRole && clientes.length > 0) {
    const grouped = await prisma.userClienteAssignment.groupBy({
      by: ["clienteId"],
      where: {
        active: true,
        clienteId: { in: clientes.map((c) => c.id) },
        user: { active: true, ...whereHasRole("FSR") },
      },
      _count: { userId: true },
    });
    for (const g of grouped) {
      fsrCountByCliente.set(g.clienteId, g._count.userId);
    }
  }

  return {
    data: clientes.map((cliente) => ({
      ...cliente,
      fsrCount: fsrCountByCliente.get(cliente.id) ?? 0,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get single Cliente by ID
 */
export async function getClienteById(id: string) {
  await requirePermission("clientes:read");

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      state: true,
      users: {
        where: { active: true },
        include: {
          ...includeRoles,
          userStatus: true,
        },
      },
      incidents: {
        where: { active: true },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          type: true,
          status: true,
        },
      },
      lines: {
        where: { active: true },
        include: {
          equipments: {
            where: { active: true },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          users: true,
          incidents: true,
          scheduleClientes: true,
          lines: true,
        },
      },
    },
  });

  return cliente;
}

/**
 * Create new Cliente
 */
export async function createCliente(data: ClienteFormData) {
  await requirePermission("clientes:create");

  const cliente = await prisma.cliente.create({
    data: {
      code: data.code,
      name: data.name,
      address: data.address || null,
      rfc: data.rfc || null,
      companyName: data.companyName || null,
      phone: data.phone || null,
      contact: data.contact || null,
      email: data.email || null,
      stateId: data.stateId,
    },
    include: {
      state: true,
    },
  });

  // Assign FSRs to this Cliente if provided
  if (data.fsrIds && data.fsrIds.length > 0) {
    for (const fsrId of data.fsrIds) {
      await prisma.userClienteAssignment.upsert({
        where: { userId_clienteId: { userId: fsrId, clienteId: cliente.id } },
        update: { active: true },
        create: { userId: fsrId, clienteId: cliente.id, isPrimary: false },
      });
    }
  }

  // Assign CLIENT users to this Cliente if provided
  if (data.clientIds && data.clientIds.length > 0) {
    for (const clientId of data.clientIds) {
      await assignUserToCliente(clientId, cliente.id, true);
    }
  }

  revalidatePath("/admin/clientes");
  return { success: true, data: cliente };
}

/**
 * Update existing Cliente
 */
export async function updateCliente(id: string, data: ClienteFormData) {
  await requirePermission("clientes:update");

  const cliente = await prisma.cliente.update({
    where: { id },
    data: {
      code: data.code,
      name: data.name,
      address: data.address || null,
      rfc: data.rfc || null,
      companyName: data.companyName || null,
      phone: data.phone || null,
      contact: data.contact || null,
      email: data.email || null,
      stateId: data.stateId,
    },
    include: {
      state: true,
    },
  });

  // Handle FSR reassignment
  if (data.fsrIds !== undefined) {
    // Get FSR role
    const fsrRole = await prisma.role.findFirst({
      where: { name: "FSR" },
    });

    if (fsrRole) {
      // Get currently assigned FSRs via junction table
      const currentAssignments = await prisma.userClienteAssignment.findMany({
        where: { clienteId: id, active: true, user: whereHasRole("FSR") },
        select: { userId: true },
      });

      const currentFSRIds = currentAssignments.map((a) => a.userId);
      const newFSRIds = data.fsrIds;

      // FSRs to unassign (were assigned but are no longer selected)
      const fsrsToUnassign = currentFSRIds.filter(
        (fsrId) => !newFSRIds.includes(fsrId),
      );

      // FSRs to assign (newly selected)
      const fsrsToAssign = newFSRIds.filter(
        (fsrId) => !currentFSRIds.includes(fsrId),
      );

      // Unassign FSRs - soft delete the assignment
      if (fsrsToUnassign.length > 0) {
        await prisma.userClienteAssignment.updateMany({
          where: { clienteId: id, userId: { in: fsrsToUnassign } },
          data: { active: false },
        });
      }

      // Assign new FSRs - upsert assignments
      for (const fsrId of fsrsToAssign) {
        await prisma.userClienteAssignment.upsert({
          where: { userId_clienteId: { userId: fsrId, clienteId: id } },
          update: { active: true },
          create: { userId: fsrId, clienteId: id, isPrimary: false },
        });
      }
    }
  }

  // Handle CLIENT user reassignment via UserClienteAssignment
  if (data.clientIds !== undefined) {
    // Get CLIENT role
    const clientRole = await prisma.role.findFirst({
      where: { name: "CLIENT" },
    });

    if (clientRole) {
      // Get currently assigned CLIENT users via junction table
      const currentAssignments = await prisma.userClienteAssignment.findMany({
        where: {
          clienteId: id,
          active: true,
          user: whereHasRole("CLIENT"),
        },
        select: { userId: true },
      });

      const currentClientIds = currentAssignments.map((a) => a.userId);
      const newClientIds = data.clientIds;

      // CLIENTs to unassign (were assigned but are no longer selected)
      const clientsToUnassign = currentClientIds.filter(
        (clientId) => !newClientIds.includes(clientId),
      );

      // CLIENTs to assign (newly selected)
      const clientsToAssign = newClientIds.filter(
        (clientId) => !currentClientIds.includes(clientId),
      );

      // Unassign CLIENTs - soft delete the assignment
      if (clientsToUnassign.length > 0) {
        await prisma.userClienteAssignment.updateMany({
          where: { clienteId: id, userId: { in: clientsToUnassign } },
          data: { active: false },
        });
      }

      // Assign new CLIENTs
      for (const clientId of clientsToAssign) {
        await assignUserToCliente(clientId, id, true);
      }
    }
  }

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
  return { success: true, data: cliente };
}

/**
 * Delete Cliente (soft delete)
 */
export async function deleteCliente(id: string) {
  await requirePermission("clientes:delete");

  // Check if Cliente has active user assignments
  const userCount = await prisma.userClienteAssignment.count({
    where: { clienteId: id, active: true },
  });

  if (userCount > 0) {
    return rejected(
      `No se puede eliminar: ${userCount} usuario(s) activo(s) están asignados a este centro.`,
    );
  }

  await prisma.cliente.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

/**
 * Get all states for Cliente form
 */
export async function getStates() {
  await requirePermission("clientes:read");

  const states = await prisma.state.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return states;
}

/**
 * Get all FSR users
 */
export async function getFSRUsers() {
  await requirePermission("users:read");

  // Get the FSR role
  const fsrRole = await prisma.role.findFirst({
    where: { name: "FSR" },
  });

  if (!fsrRole) {
    return [];
  }

  const fsrUsers = await prisma.user.findMany({
    where: {
      ...whereHasRole("FSR"),
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      clienteAssignments: {
        where: { active: true },
        select: { clienteId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Map clienteAssignments to clienteIds for backward compatibility with consumers
  return fsrUsers.map((user) => ({
    ...user,
    clienteIds: user.clienteAssignments.map((va) => va.clienteId),
  }));
}

/**
 * Get all CLIENT users
 */
export async function getClientUsers() {
  await requirePermission("users:read");

  // Get the CLIENT role
  const clientRole = await prisma.role.findFirst({
    where: { name: "CLIENT" },
  });

  if (!clientRole) {
    return [];
  }

  const clientUsers = await prisma.user.findMany({
    where: {
      ...whereHasRole("CLIENT"),
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      clienteAssignments: {
        where: { active: true, isPrimary: true },
        select: { clienteId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Map clienteAssignments to clienteId for backward compatibility
  return clientUsers.map((user) => ({
    ...user,
    clienteId: user.clienteAssignments[0]?.clienteId ?? null,
  }));
}
