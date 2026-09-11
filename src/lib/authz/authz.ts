// src/lib/authz/authz.ts

import { prisma } from "@/lib/database/prisma.singleton";
import type { PermissionName } from "./permission-catalog";
import { canAccessRoute, type RouteGrants } from "./route-access";

/**
 * Capabilities that used to be implied by the role NAME `ADMINISTRADOR`.
 *
 * That one string stood for four unrelated things — bypass every check, see
 * every Client, override other people's records, and be the audience for
 * operational notifications. Splitting the last three into permissions is what
 * lets an operations admin do their job without becoming a second root.
 */
// NOTE (PR2): the value moved with the single sessionVersion bump
// (spec ADDED-2). Pre-PR2 tokens carrying "scope:all-clientes" fail
// validation until re-login; fresh logins emit "scope:all-clients".
export const SCOPE_ALL_CLIENTS: PermissionName = "scope:all-clients";

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
  exact: boolean;
};

export type Role = {
  id: number;
  name: string;
  /** Stable system identity (H-09); null for custom UI-created roles. */
  code: string | null;
  description: string | null;
  defaultPath: string;
  isSuperuser: boolean;
  priority: number;
  permissions: Permission[];
};

/**
 * Everything authorization needs about a user, flattened.
 *
 * A user holds MANY roles and gets the UNION of their permissions: someone can
 * administer vacations, administer operations, and still be an FSR who gets
 * dispatched. Callers must not reach for a single `role` — there isn't one.
 */
export type UserAuthz = {
  roles: Role[];
  /** Union of permission names across every active role. */
  permissions: Set<string>;
  /** Union of `resource:action` pairs, for `userCanPerformAction`. */
  resourceActions: Set<string>;
  /** Route grants, already split into prefix and exact matches. */
  routeGrants: RouteGrants;
  /** Any role marked `isSuperuser` (ROOT). */
  isSuperuser: boolean;
  /** Landing page: `defaultPath` of the highest-priority role. */
  defaultPath: string;
};

export type UserWithPermissions = {
  id: string;
  email: string;
  name: string;
} & UserAuthz;

/**
 * Cache wrapper for database queries
 * Uses React's cache for request-level memoization
 *
 * Fase 5c (H-16): `getUserAuthz` keys on `userId + sessionVersion`.
 * `getAuthenticatedUser` reads `sessionVersion` from the database on EVERY
 * request, so a session bump (`invalidateRoleSessions` after a role edit)
 * changes the key and every instance refetches on the next request —
 * revocation is instant cluster-wide instead of lingering up to the TTL.
 * Changes that do NOT bump the version (new permission rows, direct DB
 * edits) still rely on the TTL below, kept short (60 s) for that reason.
 */
const CACHE_TTL = 60 * 1000; // 60 seconds
const permissionsCache = new Map<
  string,
  { data: unknown; timestamp: number }
>();

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

const roleInclude = {
  rolePermission: {
    where: { active: true },
    include: { permission: true },
  },
} as const;

type RoleRow = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  defaultPath: string;
  isSuperuser: boolean;
  priority: number;
  active: boolean;
  rolePermission: Array<{ permission: Permission & { active: boolean } }>;
};

function toRole(role: RoleRow): Role {
  return {
    id: role.id,
    name: role.name,
    code: role.code ?? null,
    description: role.description,
    defaultPath: role.defaultPath,
    isSuperuser: role.isSuperuser,
    priority: role.priority,
    permissions: role.rolePermission
      .filter((rp) => rp.permission.active)
      .map((rp) => rp.permission),
  };
}

/**
 * Collapse a set of roles into one authorization view.
 *
 * Exported so tests and the JWT callback can build the same view from roles
 * they already loaded, without a second query.
 */
export function mergeRoles(roles: Role[]): UserAuthz {
  const permissions = new Set<string>();
  const resourceActions = new Set<string>();
  const prefixes = new Set<string>();
  const exact = new Set<string>();

  for (const role of roles) {
    for (const perm of role.permissions) {
      permissions.add(perm.name);
      if (perm.resource && perm.action) {
        resourceActions.add(`${perm.resource}:${perm.action}`);
      }
      if (perm.routePath) {
        (perm.exact ? exact : prefixes).add(perm.routePath);
      }
    }
  }

  // Highest priority wins the landing page; ties break on role id so the
  // result is stable rather than dependent on query order.
  const landing = [...roles].sort(
    (a, b) => b.priority - a.priority || a.id - b.id,
  )[0];

  return {
    roles,
    permissions,
    resourceActions,
    routeGrants: { prefixes: [...prefixes], exact: [...exact] },
    isSuperuser: roles.some((role) => role.isSuperuser),
    defaultPath: landing?.defaultPath ?? "/",
  };
}

/**
 * Every active role a user holds, with permissions, merged into one view.
 *
 * `sessionVersion` is part of the cache key (Fase 5c): callers that already
 * read it per request — `getAuthenticatedUser` does — get instant
 * cross-instance invalidation on role edits for free.
 */
export async function getUserAuthz(
  userId: string,
  sessionVersion?: number,
): Promise<UserAuthz | null> {
  return getCached(
    `user-authz-${userId}-${sessionVersion ?? "none"}`,
    async () => {
      const userRoles = await prisma.userRole.findMany({
        where: { userId, active: true, role: { active: true } },
        include: { role: { include: roleInclude } },
      });

      // A user with no active role is not "unauthorized-by-default with an empty
      // list" — that would silently look like a valid session with no access.
      // Callers treat null as "cannot authenticate".
      if (userRoles.length === 0) return null;

      return mergeRoles(userRoles.map((ur) => toRole(ur.role as RoleRow)));
    },
  );
}

/**
 * Get all roles from database with their permissions
 */
export async function getAllRoles(): Promise<Role[]> {
  return getCached("all-roles", async () => {
    const roles = await prisma.role.findMany({
      where: { active: true },
      include: roleInclude,
    });
    return roles.map((role) => toRole(role as RoleRow));
  });
}

/**
 * Get a specific role by ID with permissions
 */
export async function getRoleById(roleId: number): Promise<Role | null> {
  return getCached(`role-${roleId}`, async () => {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: roleInclude,
    });
    if (!role || !role.active) return null;
    return toRole(role as RoleRow);
  });
}

/**
 * Get a specific role by stable code with permissions.
 *
 * `getRoleByName` below stays for label lookups (admin UI); logic uses this.
 */
export async function getRoleByCode(roleCode: string): Promise<Role | null> {
  return getCached(`role-code-${roleCode}`, async () => {
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
      include: roleInclude,
    });
    if (!role || !role.active) return null;
    return toRole(role as RoleRow);
  });
}

/**
 * Get a specific role by name with permissions
 */
export async function getRoleByName(roleName: string): Promise<Role | null> {
  return getCached(`role-name-${roleName}`, async () => {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
      include: roleInclude,
    });
    if (!role || !role.active) return null;
    return toRole(role as RoleRow);
  });
}

/** Check if a role has a specific permission */
export function roleHasPermission(
  role: Role,
  permissionName: PermissionName,
): boolean {
  return role.permissions.some((perm) => perm.name === permissionName);
}

/** Check whether the user may access a route. */
export function userCanAccessRoute(
  user: UserAuthz,
  routePath: string,
): boolean {
  return canAccessRoute(user.routeGrants, user.isSuperuser, routePath);
}

/** Every route the user can reach, for building navigation. */
export function getAccessibleRoutes(user: UserAuthz): string[] {
  return Array.from(
    new Set([
      ...(user.routeGrants.prefixes.filter(Boolean) as string[]),
      ...((user.routeGrants.exact ?? []).filter(Boolean) as string[]),
    ]),
  ).sort();
}

/**
 * Check if user has a specific permission by name.
 *
 * A superuser holds everything implicitly, so ROOT keeps working even for a
 * permission created after its role was seeded.
 */
export function userHasPermission(
  user: UserAuthz,
  permissionName: PermissionName,
): boolean {
  return user.isSuperuser || user.permissions.has(permissionName);
}

/** Check if user has permission for a resource action */
export function userCanPerformAction(
  user: UserAuthz,
  resource: string,
  action: string,
): boolean {
  return user.isSuperuser || user.resourceActions.has(`${resource}:${action}`);
}

/** Check multiple permissions (requires ALL) */
export function userHasAllPermissions(
  user: UserAuthz,
  permissionNames: PermissionName[],
): boolean {
  return permissionNames.every((permName) => userHasPermission(user, permName));
}

/** Check multiple permissions (requires ANY) */
export function userHasAnyPermission(
  user: UserAuthz,
  permissionNames: PermissionName[],
): boolean {
  return permissionNames.some((permName) => userHasPermission(user, permName));
}

/** Landing page for the user. */
export function getDefaultPath(user: UserAuthz): string {
  return user.defaultPath || "/";
}

/** True when the user holds a role that bypasses every check (ROOT). */
export function isSuperuser(user: UserAuthz): boolean {
  return user.isSuperuser;
}

/** True when the user holds a role by stable code (H-09). */
export function hasRole(user: UserAuthz, roleCode: string): boolean {
  return user.roles.some((role) => (role.code ?? role.name) === roleCode);
}

/**
 * Clear the permissions cache (useful after role/permission updates)
 */
export function clearPermissionsCache(): void {
  permissionsCache.clear();
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
