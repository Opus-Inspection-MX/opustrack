"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type RoleFormData = {
  name: string;
  description?: string;
  defaultPath: string;
  permissionIds?: number[];
};

/**
 * Get all roles with permissions
 */
export async function getRoles() {
  await requirePermission("roles:read");

  const roles = await prisma.role.findMany({
    where: { active: true },
    include: {
      rolePermission: {
        include: {
          permission: true,
        },
      },
      _count: {
        select: { users: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return roles;
}

/**
 * Get single role by ID
 */
export async function getRoleById(id: number) {
  await requirePermission("roles:read");

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermission: {
        include: {
          permission: true,
        },
      },
      _count: {
        select: { users: true },
      },
    },
  });

  return role;
}

/**
 * Create new role
 */
export async function createRole(data: RoleFormData) {
  await requirePermission("roles:create");

  const role = await prisma.role.create({
    data: {
      name: data.name,
      description: data.description || null,
      defaultPath: data.defaultPath,
    },
  });

  // Assign permissions if provided
  if (data.permissionIds && data.permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: data.permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
    });
  }

  revalidatePath("/admin/roles");
  return { success: true, data: role };
}

/**
 * Update existing role
 */
export async function updateRole(id: number, data: RoleFormData) {
  await requirePermission("roles:update");

  const role = await prisma.role.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      defaultPath: data.defaultPath,
    },
  });

  // Update permissions if provided
  if (data.permissionIds !== undefined) {
    // Remove all existing permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    // Add new permissions
    if (data.permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }
  }

  revalidatePath("/admin/roles");
  revalidatePath(`/admin/roles/${id}`);
  return { success: true, data: role };
}

/**
 * Delete role (soft delete)
 */
export async function deleteRole(id: number) {
  await requirePermission("roles:delete");

  // Check if role has users
  const userCount = await prisma.user.count({
    where: { roleId: id, active: true },
  });

  if (userCount > 0) {
    throw new Error(
      `Cannot delete role. ${userCount} user(s) are currently assigned to this role.`
    );
  }

  await prisma.role.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/roles");
  redirect("/admin/roles");
}

/**
 * Get all permissions for role assignment
 */
export async function getAllPermissions() {
  await requirePermission("permissions:read");

  const permissions = await prisma.permission.findMany({
    where: { active: true },
    orderBy: [{ resource: "asc" }, { action: "asc" }],
  });

  return permissions;
}

/**
 * Assign permissions to role
 */
export async function assignPermissionsToRole(
  roleId: number,
  permissionIds: number[]
) {
  await requirePermission("roles:update");

  // Remove existing permissions
  await prisma.rolePermission.deleteMany({
    where: { roleId },
  });

  // Add new permissions
  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
    });
  }

  revalidatePath("/admin/roles");
  revalidatePath(`/admin/roles/${roleId}`);
  revalidatePath(`/admin/roles/${roleId}/permissions`);
  return { success: true };
}
