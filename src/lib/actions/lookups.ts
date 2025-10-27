"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ==================== STATES ====================

export type StateFormData = {
  name: string;
  code: string;
  active?: boolean;
};

export async function getStatesAdmin() {
  await requirePermission("states:read");

  const states = await prisma.state.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { vehicleInspectionCenters: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return states;
}

export async function getStateById(id: number) {
  await requirePermission("states:read");

  const state = await prisma.state.findUnique({
    where: { id },
    include: {
      vehicleInspectionCenters: {
        where: { active: true },
      },
    },
  });

  return state;
}

export async function createState(data: StateFormData) {
  await requirePermission("states:create");

  const state = await prisma.state.create({
    data: {
      name: data.name,
      code: data.code,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/states");
  return { success: true, data: state };
}

export async function updateState(id: number, data: StateFormData) {
  await requirePermission("states:update");

  const state = await prisma.state.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/states");
  revalidatePath(`/admin/states/${id}`);
  return { success: true, data: state };
}

export async function deleteState(id: number) {
  await requirePermission("states:delete");

  const vicCount = await prisma.vehicleInspectionCenter.count({
    where: { stateId: id, active: true },
  });

  if (vicCount > 0) {
    throw new Error(
      `Cannot delete state. ${vicCount} VIC(s) are in this state.`
    );
  }

  await prisma.state.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/states");
  redirect("/admin/states");
}

// ==================== USER STATUS ====================

export type UserStatusFormData = {
  name: string;
  active?: boolean;
};

export async function getUserStatuses() {
  await requirePermission("user-status:read");

  const statuses = await prisma.userStatus.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { users: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return statuses;
}

export async function getUserStatusById(id: number) {
  await requirePermission("user-status:read");

  const status = await prisma.userStatus.findUnique({
    where: { id },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });

  return status;
}

export async function createUserStatus(data: UserStatusFormData) {
  await requirePermission("user-status:create");

  const status = await prisma.userStatus.create({
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/user-status");
  return { success: true, data: status };
}

export async function updateUserStatus(id: number, data: UserStatusFormData) {
  await requirePermission("user-status:update");

  const status = await prisma.userStatus.update({
    where: { id },
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/user-status");
  revalidatePath(`/admin/user-status/${id}`);
  return { success: true, data: status };
}

export async function deleteUserStatus(id: number) {
  await requirePermission("user-status:delete");

  const userCount = await prisma.user.count({
    where: { userStatusId: id, active: true },
  });

  if (userCount > 0) {
    throw new Error(
      `Cannot delete status. ${userCount} user(s) have this status.`
    );
  }

  await prisma.userStatus.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/user-status");
  redirect("/admin/user-status");
}

// ==================== INCIDENT TYPES ====================

export type IncidentTypeFormData = {
  name: string;
  description?: string;
  active?: boolean;
};

export async function getIncidentTypes() {
  await requirePermission("incident-types:read");

  const types = await prisma.incidentType.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { incidents: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return types;
}

export async function getIncidentTypeById(id: number) {
  await requirePermission("incident-types:read");

  const type = await prisma.incidentType.findUnique({
    where: { id },
    include: {
      _count: {
        select: { incidents: true },
      },
    },
  });

  return type;
}

export async function createIncidentType(data: IncidentTypeFormData) {
  await requirePermission("incident-types:create");

  const type = await prisma.incidentType.create({
    data: {
      name: data.name,
      description: data.description || null,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/incident-types");
  return { success: true, data: type };
}

export async function updateIncidentType(id: number, data: IncidentTypeFormData) {
  await requirePermission("incident-types:update");

  const type = await prisma.incidentType.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/incident-types");
  revalidatePath(`/admin/incident-types/${id}`);
  return { success: true, data: type };
}

export async function deleteIncidentType(id: number) {
  await requirePermission("incident-types:delete");

  const incidentCount = await prisma.incident.count({
    where: { typeId: id, active: true },
  });

  if (incidentCount > 0) {
    throw new Error(
      `Cannot delete type. ${incidentCount} incident(s) have this type.`
    );
  }

  await prisma.incidentType.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/incident-types");
  redirect("/admin/incident-types");
}

// ==================== INCIDENT STATUS ====================

export type IncidentStatusFormData = {
  name: string;
  active?: boolean;
};

export async function getIncidentStatuses() {
  await requirePermission("incident-status:read");

  const statuses = await prisma.incidentStatus.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { incidents: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return statuses;
}

export async function getIncidentStatusById(id: number) {
  await requirePermission("incident-status:read");

  const status = await prisma.incidentStatus.findUnique({
    where: { id },
    include: {
      _count: {
        select: { incidents: true },
      },
    },
  });

  return status;
}

export async function createIncidentStatus(data: IncidentStatusFormData) {
  await requirePermission("incident-status:create");

  const status = await prisma.incidentStatus.create({
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/incident-status");
  return { success: true, data: status };
}

export async function updateIncidentStatus(id: number, data: IncidentStatusFormData) {
  await requirePermission("incident-status:update");

  const status = await prisma.incidentStatus.update({
    where: { id },
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/incident-status");
  revalidatePath(`/admin/incident-status/${id}`);
  return { success: true, data: status };
}

export async function deleteIncidentStatus(id: number) {
  await requirePermission("incident-status:delete");

  const incidentCount = await prisma.incident.count({
    where: { statusId: id, active: true },
  });

  if (incidentCount > 0) {
    throw new Error(
      `Cannot delete status. ${incidentCount} incident(s) have this status.`
    );
  }

  await prisma.incidentStatus.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/incident-status");
  redirect("/admin/incident-status");
}

// ==================== PERMISSIONS ====================

export type PermissionFormData = {
  name: string;
  description?: string;
  resource?: string;
  action?: string;
  routePath?: string;
};

export async function getPermissions() {
  await requirePermission("permissions:read");

  const permissions = await prisma.permission.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { roles: true },
      },
    },
    orderBy: [{ resource: "asc" }, { action: "asc" }],
  });

  return permissions;
}

export async function getPermissionById(id: number) {
  await requirePermission("permissions:read");

  const permission = await prisma.permission.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  return permission;
}

export async function createPermission(data: PermissionFormData) {
  await requirePermission("permissions:manage");

  const permission = await prisma.permission.create({
    data: {
      name: data.name,
      description: data.description || null,
      resource: data.resource || null,
      action: data.action || null,
      routePath: data.routePath || null,
    },
  });

  revalidatePath("/admin/permissions");
  return { success: true, data: permission };
}

export async function updatePermission(id: number, data: PermissionFormData) {
  await requirePermission("permissions:manage");

  const permission = await prisma.permission.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      resource: data.resource || null,
      action: data.action || null,
      routePath: data.routePath || null,
    },
  });

  revalidatePath("/admin/permissions");
  revalidatePath(`/admin/permissions/${id}`);
  return { success: true, data: permission };
}

export async function deletePermission(id: number) {
  await requirePermission("permissions:manage");

  const roleCount = await prisma.rolePermission.count({
    where: { permissionId: id, active: true },
  });

  if (roleCount > 0) {
    throw new Error(
      `Cannot delete permission. ${roleCount} role(s) have this permission.`
    );
  }

  await prisma.permission.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/permissions");
  redirect("/admin/permissions");
}
