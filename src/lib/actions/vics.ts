"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type VICFormData = {
  code: string;
  name: string;
  address?: string;
  rfc?: string;
  companyName?: string;
  phone?: string;
  contact?: string;
  email?: string;
  lines: number;
  stateId: number;
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
      _count: {
        select: {
          users: true,
          incidents: true,
          Part: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return vics;
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
      Part: {
        where: { active: true },
        take: 10,
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          users: true,
          incidents: true,
          Part: true,
          schedules: true,
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
      lines: data.lines,
      stateId: data.stateId,
    },
    include: {
      state: true,
    },
  });

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
      lines: data.lines,
      stateId: data.stateId,
    },
    include: {
      state: true,
    },
  });

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
      `Cannot delete VIC. ${userCount} active user(s) are assigned to this center.`
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
