"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { rejected } from "./result";

export type RoleFormData = {
  name: string;
  description?: string;
  defaultPath: string;
  permissionIds?: number[];
};

export type RoleListParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Get all roles with permissions (paginated, server-side search).
 * Search matches name or description (case-insensitive).
 */
export async function getRoles(params?: RoleListParams): Promise<{
  data: Array<{
    id: number;
    name: string;
    description: string | null;
    defaultPath: string;
    rolePermission: Array<{ permission: { id: number; name: string } }>;
    _count: { users: number };
  }>;
  pagination: PaginationMeta;
}> {
  await requirePermission("roles:read");

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const search = params?.search?.trim() ?? "";
  const skip = (page - 1) * limit;

  const where = {
    active: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.role.findMany({
      where,
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
      skip,
      take: limit,
    }),
    prisma.role.count({ where }),
  ]);

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

/**
 * Get all active roles as a flat array for dropdown/select usage.
 * Does NOT paginate — returns the full list.
 */
export async function getRolesForSelect() {
  await requirePermission("roles:read");

  return prisma.role.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      description: true,
      defaultPath: true,
    },
    orderBy: { name: "asc" },
  });
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
    return rejected(
      `No se puede eliminar: ${userCount} usuario(s) tienen este rol asignado.`,
    );
  }

  await prisma.role.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/roles");
  return { success: true };
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
  permissionIds: number[],
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

  // Invalidate sessions for all users with this role
  const { invalidateRoleSessions } = await import(
    "@/lib/auth/session-management"
  );
  await invalidateRoleSessions(roleId);

  // Clear the in-memory permissions cache (5 min TTL) so in-flight requests do
  // not keep serving the role's stale permissions until the cache expires.
  const { clearPermissionsCache } = await import("@/lib/authz/authz");
  clearPermissionsCache();

  revalidatePath("/admin/roles");
  revalidatePath(`/admin/roles/${roleId}`);
  revalidatePath(`/admin/roles/${roleId}/permissions`);
  return { success: true };
}
