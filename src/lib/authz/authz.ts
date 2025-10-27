// src/lib/authz/authz.ts
import { prisma } from "@/lib/database/prisma.singleton";
import { cache } from "react";

/**
 * Type definitions for authorization
 */
export type Permission = {
  id: number;
  name: string;
  description: string | null;
  resource: string | null;
  action: string | null;
  routePath: string | null;
};

export type Role = {
  id: number;
  name: string;
  description: string | null;
  defaultPath: string;
  permissions: Permission[];
};

export type UserWithPermissions = {
  id: string;
  email: string;
  name: string;
  roleId: number;
  role: Role;
  vicId: string | null;
};

/**
 * Cache wrapper for database queries
 * Uses React's cache for request-level memoization
 */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const permissionsCache = new Map<string, { data: any; timestamp: number }>();

function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = permissionsCache.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return Promise.resolve(cached.data as T);
  }

  return fetcher().then((data) => {
    permissionsCache.set(key, { data, timestamp: now });
    return data;
  });
}

/**
 * Get all roles from database with their permissions
 */
export async function getAllRoles(): Promise<Role[]> {
  return getCached("all-roles", async () => {
    const roles = await prisma.role.findMany({
      where: { active: true },
      include: {
        rolePermission: {
          where: { active: true },
          include: {
            permission: true,
          },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      defaultPath: role.defaultPath,
      permissions: role.rolePermission
        .filter((rp) => rp.permission.active)
        .map((rp) => rp.permission),
    }));
  });
}

/**
 * Get a specific role by ID with permissions
 */
export async function getRoleById(roleId: number): Promise<Role | null> {
  return getCached(`role-${roleId}`, async () => {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermission: {
          where: { active: true },
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role || !role.active) return null;

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      defaultPath: role.defaultPath,
      permissions: role.rolePermission
        .filter((rp) => rp.permission.active)
        .map((rp) => rp.permission),
    };
  });
}

/**
 * Get a specific role by name with permissions
 */
export async function getRoleByName(roleName: string): Promise<Role | null> {
  return getCached(`role-name-${roleName}`, async () => {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
      include: {
        rolePermission: {
          where: { active: true },
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role || !role.active) return null;

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      defaultPath: role.defaultPath,
      permissions: role.rolePermission
        .filter((rp) => rp.permission.active)
        .map((rp) => rp.permission),
    };
  });
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role, permissionName: string): boolean {
  return role.permissions.some((perm) => perm.name === permissionName);
}

/**
 * Check if a role has access to a specific route
 */
export function roleCanAccessRoute(role: Role, routePath: string): boolean {
  // Normalize route path (remove trailing slash, handle params)
  const normalizedPath = routePath.replace(/\/$/, "") || "/";

  // Check for exact route permission match
  const hasRoutePermission = role.permissions.some(
    (perm) => perm.routePath && normalizedPath.startsWith(perm.routePath)
  );

  if (hasRoutePermission) return true;

  // Admin role gets access to everything
  if (role.name === "ADMINISTRADOR") return true;

  return false;
}

/**
 * Get all accessible routes for a role
 */
export function getAccessibleRoutes(role: Role): string[] {
  const routes = role.permissions
    .filter((perm) => perm.routePath)
    .map((perm) => perm.routePath as string);

  // Remove duplicates and sort
  return Array.from(new Set(routes)).sort();
}

/**
 * Check if user has a specific permission by name
 */
export function userHasPermission(
  user: UserWithPermissions,
  permissionName: string
): boolean {
  return roleHasPermission(user.role, permissionName);
}

/**
 * Check if user has permission for a resource action
 */
export function userCanPerformAction(
  user: UserWithPermissions,
  resource: string,
  action: string
): boolean {
  return user.role.permissions.some(
    (perm) => perm.resource === resource && perm.action === action
  );
}

/**
 * Get all permissions for a specific resource
 */
export function getUserResourcePermissions(
  user: UserWithPermissions,
  resource: string
): Permission[] {
  return user.role.permissions.filter((perm) => perm.resource === resource);
}

/**
 * Check multiple permissions (requires ALL)
 */
export function userHasAllPermissions(
  user: UserWithPermissions,
  permissionNames: string[]
): boolean {
  return permissionNames.every((permName) =>
    userHasPermission(user, permName)
  );
}

/**
 * Check multiple permissions (requires ANY)
 */
export function userHasAnyPermission(
  user: UserWithPermissions,
  permissionNames: string[]
): boolean {
  return permissionNames.some((permName) =>
    userHasPermission(user, permName)
  );
}

/**
 * Get default path for a role
 */
export function getDefaultPath(role: Role): string {
  return role.defaultPath || "/";
}

/**
 * Clear the permissions cache (useful after role/permission updates)
 */
export function clearPermissionsCache(): void {
  permissionsCache.clear();
}

/**
 * Helper to check if user is admin
 */
export function isAdmin(user: UserWithPermissions): boolean {
  return user.role.name === "ADMINISTRADOR";
}

/**
 * Get all permissions from database
 */
export async function getAllPermissions(): Promise<Permission[]> {
  return getCached("all-permissions", async () => {
    return await prisma.permission.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  });
}
