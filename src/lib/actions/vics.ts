"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { assignUserToVic } from "@/lib/utils/vic-assignments";

export type VICFormData = {
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

/**
 * Get all VICs with relations
 */
export async function getVICs() {
  await requirePermission("vics:read");

  const vics = await prisma.vehicleInspectionCenter.findMany({
    where: { active: true },
    include: {
      state: true,
      lines: {
        where: { active: true },
        select: {
          id: true,
          _count: {
            select: {
              equipments: true,
            },
          },
        },
      },
      _count: {
        select: {
          users: true,
          incidents: true,
          lines: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get FSR role
  const fsrRole = await prisma.role.findFirst({
    where: { name: "FSR" },
  });

  // For each VIC, count how many FSRs have this VIC in their vicIds array
  const vicsWithFSRCount = await Promise.all(
    vics.map(async (vic) => {
      if (!fsrRole) {
        return { ...vic, fsrCount: 0 };
      }

      const fsrCount = await prisma.user.count({
        where: {
          roleId: fsrRole.id,
          active: true,
          vicAssignments: {
            some: { vicId: vic.id, active: true },
          },
        },
      });

      return { ...vic, fsrCount };
    }),
  );

  return vicsWithFSRCount;
}

/**
 * Get single VIC by ID
 */
export async function getVICById(id: string) {
  await requirePermission("vics:read");

  const vic = await prisma.vehicleInspectionCenter.findUnique({
    where: { id },
    include: {
      state: true,
      users: {
        where: { active: true },
        include: {
          role: true,
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
          scheduleVics: true,
          lines: true,
        },
      },
    },
  });

  return vic;
}

/**
 * Create new VIC
 */
export async function createVIC(data: VICFormData) {
  await requirePermission("vics:create");

  const vic = await prisma.vehicleInspectionCenter.create({
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

  // Assign FSRs to this VIC if provided
  if (data.fsrIds && data.fsrIds.length > 0) {
    for (const fsrId of data.fsrIds) {
      await prisma.userVicAssignment.upsert({
        where: { userId_vicId: { userId: fsrId, vicId: vic.id } },
        update: { active: true },
        create: { userId: fsrId, vicId: vic.id, isPrimary: false },
      });
    }
  }

  // Assign CLIENT users to this VIC if provided
  if (data.clientIds && data.clientIds.length > 0) {
    for (const clientId of data.clientIds) {
      await assignUserToVic(clientId, vic.id, true);
    }
  }

  revalidatePath("/admin/vic-centers");
  return { success: true, data: vic };
}

/**
 * Update existing VIC
 */
export async function updateVIC(id: string, data: VICFormData) {
  await requirePermission("vics:update");

  const vic = await prisma.vehicleInspectionCenter.update({
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
      const currentAssignments = await prisma.userVicAssignment.findMany({
        where: { vicId: id, active: true, user: { roleId: fsrRole.id } },
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
        await prisma.userVicAssignment.updateMany({
          where: { vicId: id, userId: { in: fsrsToUnassign } },
          data: { active: false },
        });
      }

      // Assign new FSRs - upsert assignments
      for (const fsrId of fsrsToAssign) {
        await prisma.userVicAssignment.upsert({
          where: { userId_vicId: { userId: fsrId, vicId: id } },
          update: { active: true },
          create: { userId: fsrId, vicId: id, isPrimary: false },
        });
      }
    }
  }

  // Handle CLIENT user reassignment via UserVicAssignment
  if (data.clientIds !== undefined) {
    // Get CLIENT role
    const clientRole = await prisma.role.findFirst({
      where: { name: "CLIENT" },
    });

    if (clientRole) {
      // Get currently assigned CLIENT users via junction table
      const currentAssignments = await prisma.userVicAssignment.findMany({
        where: {
          vicId: id,
          active: true,
          user: { roleId: clientRole.id },
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
        await prisma.userVicAssignment.updateMany({
          where: { vicId: id, userId: { in: clientsToUnassign } },
          data: { active: false },
        });
      }

      // Assign new CLIENTs
      for (const clientId of clientsToAssign) {
        await assignUserToVic(clientId, id, true);
      }
    }
  }

  revalidatePath("/admin/vic-centers");
  revalidatePath(`/admin/vic-centers/${id}`);
  return { success: true, data: vic };
}

/**
 * Delete VIC (soft delete)
 */
export async function deleteVIC(id: string) {
  await requirePermission("vics:delete");

  // Check if VIC has active user assignments
  const userCount = await prisma.userVicAssignment.count({
    where: { vicId: id, active: true },
  });

  if (userCount > 0) {
    throw new Error(
      `Cannot delete VIC. ${userCount} active user(s) are assigned to this center.`,
    );
  }

  await prisma.vehicleInspectionCenter.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/vic-centers");
  redirect("/admin/vic-centers");
}

/**
 * Get all states for VIC form
 */
export async function getStates() {
  await requirePermission("vics:read");

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
      roleId: fsrRole.id,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      vicAssignments: {
        where: { active: true },
        select: { vicId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Map vicAssignments to vicIds for backward compatibility with consumers
  return fsrUsers.map((user) => ({
    ...user,
    vicIds: user.vicAssignments.map((va) => va.vicId),
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
      roleId: clientRole.id,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      vicAssignments: {
        where: { active: true, isPrimary: true },
        select: { vicId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Map vicAssignments to vicId for backward compatibility
  return clientUsers.map((user) => ({
    ...user,
    vicId: user.vicAssignments[0]?.vicId ?? null,
  }));
}
