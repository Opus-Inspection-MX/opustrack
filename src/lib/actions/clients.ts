"use server";

import type { Prisma } from "@prisma/client";
import { AuditAction, AuditEntity } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit/log-audit";
import { requirePermission } from "@/lib/auth/auth";
import { ROLE } from "@/lib/authz/roles";
import { includeRoles, whereHasRole } from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import { assignUserToClient } from "@/lib/utils/client-assignments";
import { ok, rejected } from "./result";

export type ClientFormData = {
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
  reporterIds?: string[];
};

type GetClientsParams = {
  page?: number;
  limit?: number;
  search?: string;
};

/**
 * Lightweight Client list for select/dropdown inputs and filters.
 * Returns only { id, code, name, stateId } for all active Clients — no counts,
 * no pagination. Use this instead of getClients() when you just need options.
 * `stateId` lets callers narrow the options by plaza without a round-trip.
 */
export async function getClientsForSelect() {
  await requirePermission("clients:read");

  return prisma.client.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true, stateId: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Get Clients with relations, paginated and searchable (code, name, company).
 */
export async function getClients(params?: GetClientsParams) {
  await requirePermission("clients:read");

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const skip = (page - 1) * limit;
  const search = params?.search?.trim();

  const where: Prisma.ClientWhereInput = search
    ? {
        active: true,
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { companyName: { contains: search, mode: "insensitive" } },
        ],
      }
    : { active: true };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
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
          select: {
            userAssignments: true,
            incidents: true,
            lines: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  // Count active FSRs for THIS page's Clients in a single grouped query
  // (avoids an N+1: previously one user.count() per Client). Unique
  // (userId, clientId) means row count == distinct FSR count.
  // Resolved by stable role code (H-09); a missing code row is a defect.
  const fsrRole = await prisma.role.findFirst({
    where: { code: ROLE.FSR, active: true },
  });
  if (!fsrRole) throw new Error("System role 'FSR' is missing (code FSR).");
  const fsrCountByClient = new Map<string, number>();
  if (clients.length > 0) {
    const grouped = await prisma.userClientAssignment.groupBy({
      by: ["clientId"],
      where: {
        active: true,
        clientId: { in: clients.map((c) => c.id) },
        user: { active: true, ...whereHasRole(ROLE.FSR) },
      },
      _count: { userId: true },
    });
    for (const g of grouped) {
      fsrCountByClient.set(g.clientId, g._count.userId);
    }
  }

  return {
    data: clients.map((client) => ({
      ...client,
      // The badge counts assigned users: junction rows, not the removed
      // scalar relation (which only ever held the primary assignment).
      _count: {
        ...client._count,
        users: client._count.userAssignments,
      },
      fsrCount: fsrCountByClient.get(client.id) ?? 0,
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
 * Get single Client by ID
 */
export async function getClientById(id: string) {
  await requirePermission("clients:read");

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      state: true,
      // Assigned users come from the junction table (the deprecated
      // scalar relation only ever held the primary assignment).
      userAssignments: {
        where: { active: true },
        include: {
          user: {
            include: {
              ...includeRoles,
              userStatus: true,
            },
          },
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
          userAssignments: true,
          incidents: true,
          scheduleClients: true,
          lines: true,
        },
      },
    },
  });

  if (!client) return client;

  const users = client.userAssignments
    .map((a) => a.user)
    .filter((u) => u.active);
  return {
    ...client,
    users,
    _count: { ...client._count, users: users.length },
  };
}

/**
 * Create new Client
 */
export async function createClient(data: ClientFormData) {
  const actor = await requirePermission("clients:create");

  const client = await prisma.client.create({
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
      createdById: actor.id,
    },
    include: {
      state: true,
    },
  });

  // RF-551: the audit row joins the business write, never travels alone.
  await logAudit(prisma, {
    actorId: actor.id,
    entity: AuditEntity.CLIENT,
    entityId: client.id,
    action: AuditAction.CREATE,
    payload: { code: data.code, stateId: data.stateId, active: true },
  });

  // Assign FSRs to this Client if provided
  if (data.fsrIds && data.fsrIds.length > 0) {
    for (const fsrId of data.fsrIds) {
      await prisma.userClientAssignment.upsert({
        where: { userId_clientId: { userId: fsrId, clientId: client.id } },
        update: { active: true },
        create: { userId: fsrId, clientId: client.id, isPrimary: false },
      });
    }
  }

  // Assign reporter (REPORTER-role) users to this Client if provided
  if (data.reporterIds && data.reporterIds.length > 0) {
    for (const reporterId of data.reporterIds) {
      await assignUserToClient(reporterId, client.id, true);
    }
  }

  revalidatePath("/admin/clients");
  return ok({ data: client });
}

/**
 * Update existing Client
 */
export async function updateClient(id: string, data: ClientFormData) {
  const actor = await requirePermission("clients:update");

  const client = await prisma.client.update({
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
      updatedById: actor.id,
    },
    include: {
      state: true,
    },
  });

  await logAudit(prisma, {
    actorId: actor.id,
    entity: AuditEntity.CLIENT,
    entityId: client.id,
    action: AuditAction.UPDATE,
    payload: { code: data.code, stateId: data.stateId },
  });

  // Handle FSR reassignment. The FSR system role must exist: with `code`
  // it cannot go missing by rename, so absence is a DEFECT that throws —
  // never a silent ignore of the reassignment the operator requested.
  if (data.fsrIds !== undefined) {
    // Get FSR role
    const fsrRole = await prisma.role.findFirst({
      where: { code: ROLE.FSR, active: true },
    });
    if (!fsrRole) throw new Error("System role 'FSR' is missing (code FSR).");

    // Get currently assigned FSRs via junction table
    const currentAssignments = await prisma.userClientAssignment.findMany({
      where: {
        clientId: id,
        active: true,
        user: whereHasRole(ROLE.FSR),
      },
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
      await prisma.userClientAssignment.updateMany({
        where: { clientId: id, userId: { in: fsrsToUnassign } },
        data: { active: false },
      });
    }

    // Assign new FSRs - upsert assignments
    for (const fsrId of fsrsToAssign) {
      await prisma.userClientAssignment.upsert({
        where: { userId_clientId: { userId: fsrId, clientId: id } },
        update: { active: true },
        create: { userId: fsrId, clientId: id, isPrimary: false },
      });
    }
  }

  // Handle reporter (REPORTER-role) user reassignment via UserClientAssignment.
  // Same defect rule as FSR above: a missing system role throws.
  if (data.reporterIds !== undefined) {
    // Get REPORTER role
    const reporterRole = await prisma.role.findFirst({
      where: { code: ROLE.REPORTER, active: true },
    });
    if (!reporterRole)
      throw new Error("System role 'REPORTER' is missing (code REPORTER).");

    // Get currently assigned reporter users via junction table
    const currentAssignments = await prisma.userClientAssignment.findMany({
      where: {
        clientId: id,
        active: true,
        user: whereHasRole(ROLE.REPORTER),
      },
      select: { userId: true },
    });

    const currentReporterIds = currentAssignments.map((a) => a.userId);
    const newReporterIds = data.reporterIds;

    // Reporters to unassign (were assigned but are no longer selected)
    const reportersToUnassign = currentReporterIds.filter(
      (reporterId) => !newReporterIds.includes(reporterId),
    );

    // Reporters to assign (newly selected)
    const reportersToAssign = newReporterIds.filter(
      (reporterId) => !currentReporterIds.includes(reporterId),
    );

    // Unassign reporters - soft delete the assignment
    if (reportersToUnassign.length > 0) {
      await prisma.userClientAssignment.updateMany({
        where: { clientId: id, userId: { in: reportersToUnassign } },
        data: { active: false },
      });
    }

    // Assign new reporters
    for (const reporterId of reportersToAssign) {
      await assignUserToClient(reporterId, id, true);
    }
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return ok({ data: client });
}

/**
 * Delete Client (soft delete)
 */
export async function deleteClient(id: string) {
  const actor = await requirePermission("clients:delete");

  // Check if Client has active user assignments
  const userCount = await prisma.userClientAssignment.count({
    where: { clientId: id, active: true },
  });

  if (userCount > 0) {
    return rejected(
      `No se puede eliminar: ${userCount} usuario(s) activo(s) están asignados a este centro.`,
    );
  }

  await prisma.client.update({
    where: { id },
    data: {
      active: false,
      // RF-550: deactivation stamps land in the same write as the flag.
      deactivatedAt: new Date(),
      deactivatedById: actor.id,
    },
  });

  await logAudit(prisma, {
    actorId: actor.id,
    entity: AuditEntity.CLIENT,
    entityId: id,
    action: AuditAction.DEACTIVATE,
    payload: { active: false },
  });

  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}

/**
 * Get all states for Client form
 */
export async function getStates() {
  await requirePermission("clients:read");

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

  // Get the FSR role — by stable code (H-09); a missing code row is a defect.
  const fsrRole = await prisma.role.findFirst({
    where: { code: ROLE.FSR, active: true },
  });
  if (!fsrRole) throw new Error("System role 'FSR' is missing (code FSR).");

  const fsrUsers = await prisma.user.findMany({
    where: {
      ...whereHasRole(ROLE.FSR),
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      clientAssignments: {
        where: { active: true },
        select: { clientId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Map clientAssignments to clientIds for consumers (ids of real centers)
  return fsrUsers.map((user) => ({
    ...user,
    clientIds: user.clientAssignments.map((va) => va.clientId),
  }));
}

/**
 * Get all reporter users (users holding the REPORTER role)
 */
export async function getReporterUsers() {
  await requirePermission("users:read");

  // Get the REPORTER role — by stable code (H-09); missing is a defect.
  const reporterRole = await prisma.role.findFirst({
    where: { code: ROLE.REPORTER, active: true },
  });
  if (!reporterRole)
    throw new Error("System role 'REPORTER' is missing (code REPORTER).");

  const reporterUsers = await prisma.user.findMany({
    where: {
      ...whereHasRole(ROLE.REPORTER),
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      clientAssignments: {
        where: { active: true, isPrimary: true },
        select: { clientId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Map clientAssignments to clientId (id of the reporter's primary center)
  return reporterUsers.map((user) => ({
    ...user,
    clientId: user.clientAssignments[0]?.clientId ?? null,
  }));
}
