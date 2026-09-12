"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { clearPermissionsCache } from "@/lib/authz/authz";
import { assertCanManageRoles } from "@/lib/authz/role-assignment";
import { prisma } from "@/lib/database/prisma.singleton";
import { businessRule, guarded } from "./result";

export type RoleFormData = {
  name: string;
  description?: string;
  defaultPath: string;
  /**
   * Higher wins when a multi-role user needs one landing page, and orders
   * the menu. `isSuperuser` is deliberately NOT here: it stays out of the
   * UI on purpose (only seed/migration rows hold it).
   */
  priority: number;
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
    priority: number;
    rolePermission: Array<{ permission: { id: number; name: string } }>;
    _count: { userRoles: number };
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
          select: { userRoles: true },
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
      priority: true,
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
        select: { userRoles: true },
      },
    },
  });

  return role;
}

/**
 * Create new role
 */
export async function createRole(data: RoleFormData) {
  const caller = await requirePermission("roles:create");

  // `guarded` so the refusal survives a production build: Next replaces the
  // message of anything a Server Action throws, and this one has to be read.
  return guarded(async () => {
    assertCanManageRoles(caller);
    const priority = parseRolePriority(data.priority);

    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description || null,
        defaultPath: data.defaultPath,
        priority,
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

    clearPermissionsCache();
    revalidatePath("/admin/roles");
    return { data: role };
  });
}

/**
 * Update existing role.
 *
 * Fase 5c (H-15): role + permission writes share ONE transaction, and
 * `RolePermission` rows are toggled with `active` (soft delete per
 * convention) instead of `deleteMany`/`createMany` — a crash mid-edit can
 * no longer leave the role permissionless. Sessions are bumped only when
 * grants or `defaultPath` actually change.
 */
export async function updateRole(id: number, data: RoleFormData) {
  const caller = await requirePermission("roles:update");

  return guarded(async () => {
    assertCanManageRoles(caller);

    const previous = await prisma.role.findUnique({
      where: { id, active: true },
      select: {
        defaultPath: true,
        priority: true,
        rolePermission: {
          where: { active: true },
          select: { permissionId: true },
        },
      },
    });
    if (!previous) {
      businessRule("Rol no encontrado.");
    }
    const priority = parseRolePriority(data.priority);

    const role = await prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description || null,
          defaultPath: data.defaultPath,
          priority,
        },
      });

      if (data.permissionIds !== undefined) {
        await setRolePermissions(tx, id, data.permissionIds);
      }
      return updated;
    });

    const grantsChanged =
      data.permissionIds !== undefined &&
      !sameIds(
        previous?.rolePermission.map((r) => r.permissionId) ?? null,
        data.permissionIds,
      );
    if (
      grantsChanged ||
      previous?.defaultPath !== data.defaultPath ||
      previous?.priority !== priority
    ) {
      const { invalidateRoleSessions } = await import(
        "@/lib/auth/session-management"
      );
      await invalidateRoleSessions(id);
    }

    // Non-bump edits (rename, description) still ride the short authz TTL;
    // the in-instance cache is cleared so this request's followers agree.
    clearPermissionsCache();
    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${id}`);
    return { data: role };
  });
}

/**
 * Delete role (soft delete)
 */
export async function deleteRole(id: number) {
  const caller = await requirePermission("roles:delete");

  return guarded(async () => {
    assertCanManageRoles(caller);

    // Check if role has users
    const userCount = await prisma.userRole.count({
      where: { roleId: id, active: true, user: { active: true } },
    });

    if (userCount > 0) {
      businessRule(
        `No se puede eliminar: ${userCount} usuario(s) tienen este rol asignado.`,
      );
    }

    await prisma.role.update({
      where: { id },
      data: { active: false },
    });

    clearPermissionsCache();
    revalidatePath("/admin/roles");
    return { data: null };
  });
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
  const caller = await requirePermission("roles:update");

  return guarded(async () => {
    assertCanManageRoles(caller);

    const changed = await prisma.$transaction(async (tx) =>
      setRolePermissions(tx, roleId, permissionIds),
    );

    if (changed) {
      // Invalidate sessions for all users with this role
      const { invalidateRoleSessions } = await import(
        "@/lib/auth/session-management"
      );
      await invalidateRoleSessions(roleId);
    }

    // Clear the in-memory permissions cache (short TTL) so in-flight requests do
    // not keep serving the role's stale permissions until the cache expires.
    clearPermissionsCache();

    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${roleId}`);
    revalidatePath(`/admin/roles/${roleId}/permissions`);
    return { data: null };
  });
}

/** Priority arrives from a numeric input: it must be a finite integer. */
function parseRolePriority(value: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    businessRule("La prioridad debe ser un número entero.");
  }
  return value;
}

type RoleTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Fase 5c: the single permission-sync both role writers share. Existing
 * `RolePermission` rows are reactivated/deactivated with `active` (soft
 * delete); only genuinely new grants are inserted. Returns whether any
 * grant changed, so callers bump sessions only on real changes.
 */
async function setRolePermissions(
  db: RoleTx,
  roleId: number,
  permissionIds: number[],
): Promise<boolean> {
  const rows = await db.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true, active: true },
  });
  const want = new Set(permissionIds);
  const byId = new Map(rows.map((r) => [r.permissionId, r.active]));

  const toDeactivate = rows
    .filter((r) => r.active && !want.has(r.permissionId))
    .map((r) => r.permissionId);
  const toReactivate = rows
    .filter((r) => !r.active && want.has(r.permissionId))
    .map((r) => r.permissionId);
  const toCreate = permissionIds.filter((pid) => !byId.has(pid));

  let changed = false;
  if (toDeactivate.length > 0) {
    await db.rolePermission.updateMany({
      where: { roleId, permissionId: { in: toDeactivate }, active: true },
      data: { active: false },
    });
    changed = true;
  }
  if (toReactivate.length > 0) {
    await db.rolePermission.updateMany({
      where: { roleId, permissionId: { in: toReactivate } },
      data: { active: true },
    });
    changed = true;
  }
  if (toCreate.length > 0) {
    await db.rolePermission.createMany({
      data: toCreate.map((permissionId) => ({ roleId, permissionId })),
    });
    changed = true;
  }
  return changed;
}

/** Order-insensitive id comparison; null previous means "unknown, treat as changed". */
function sameIds(previous: number[] | null, next: number[]): boolean {
  if (previous === null) return false;
  if (previous.length !== next.length) return false;
  const have = new Set(previous);
  return next.every((id) => have.has(id));
}
