"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

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
          vicIds: {
            has: vic.id,
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
          schedules: true,
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
    // For each FSR, add this VIC to their vicIds array
    for (const fsrId of data.fsrIds) {
      const user = await prisma.user.findUnique({
        where: { id: fsrId },
        select: { vicIds: true },
      });

      if (user) {
        const updatedVicIds = [...new Set([...user.vicIds, vic.id])];
        await prisma.user.update({
          where: { id: fsrId },
          data: { vicIds: updatedVicIds },
        });
      }
    }
  }

  // Assign CLIENT users to this VIC if provided
  if (data.clientIds && data.clientIds.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: { in: data.clientIds },
      },
      data: {
        vicId: vic.id,
      },
    });
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
      // Get all FSRs to check which ones currently have this VIC
      const allFSRs = await prisma.user.findMany({
        where: {
          roleId: fsrRole.id,
          active: true,
        },
        select: { id: true, vicIds: true },
      });

      const currentFSRIds = allFSRs
        .filter((user) => user.vicIds.includes(id))
        .map((user) => user.id);

      const newFSRIds = data.fsrIds;

      // FSRs to unassign (were assigned but are no longer selected)
      const fsrsToUnassign = currentFSRIds.filter(
        (fsrId) => !newFSRIds.includes(fsrId),
      );

      // FSRs to assign (newly selected)
      const fsrsToAssign = newFSRIds.filter(
        (fsrId) => !currentFSRIds.includes(fsrId),
      );

      // Unassign FSRs - remove this VIC from their vicIds array
      for (const fsrId of fsrsToUnassign) {
        const user = allFSRs.find((u) => u.id === fsrId);
        if (user) {
          const updatedVicIds = user.vicIds.filter((vicId) => vicId !== id);
          await prisma.user.update({
            where: { id: fsrId },
            data: { vicIds: updatedVicIds },
          });
        }
      }

      // Assign new FSRs - add this VIC to their vicIds array
      for (const fsrId of fsrsToAssign) {
        const user = allFSRs.find((u) => u.id === fsrId);
        if (user) {
          const updatedVicIds = [...new Set([...user.vicIds, id])];
          await prisma.user.update({
            where: { id: fsrId },
            data: { vicIds: updatedVicIds },
          });
        }
      }
    }
  }

  // Handle CLIENT user reassignment
  if (data.clientIds !== undefined) {
    // Get CLIENT role
    const clientRole = await prisma.role.findFirst({
      where: { name: "CLIENT" },
    });

    if (clientRole) {
      // Get currently assigned CLIENT users
      const currentClients = await prisma.user.findMany({
        where: {
          vicId: id,
          roleId: clientRole.id,
        },
        select: { id: true },
      });

      const currentClientIds = currentClients.map((user) => user.id);
      const newClientIds = data.clientIds;

      // CLIENTs to unassign (were assigned but are no longer selected)
      const clientsToUnassign = currentClientIds.filter(
        (clientId) => !newClientIds.includes(clientId),
      );

      // CLIENTs to assign (newly selected)
      const clientsToAssign = newClientIds.filter(
        (clientId) => !currentClientIds.includes(clientId),
      );

      // Unassign CLIENTs - set vicId to null
      if (clientsToUnassign.length > 0) {
        await prisma.user.updateMany({
          where: {
            id: { in: clientsToUnassign },
          },
          data: {
            vicId: null,
          },
        });
      }

      // Assign new CLIENTs - set vicId to this VIC
      if (clientsToAssign.length > 0) {
        await prisma.user.updateMany({
          where: {
            id: { in: clientsToAssign },
          },
          data: {
            vicId: id,
          },
        });
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

  // Check if VIC has active users
  const userCount = await prisma.user.count({
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
      vicIds: true,
    },
    orderBy: { name: "asc" },
  });

  return fsrUsers;
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
      vicId: true,
    },
    orderBy: { name: "asc" },
  });

  return clientUsers;
}
