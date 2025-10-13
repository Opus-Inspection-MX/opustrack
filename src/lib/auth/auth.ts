// src/lib/auth/auth.ts
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  getRoleById,
  roleCanAccessRoute,
  userHasPermission,
  userCanPerformAction,
  getAccessibleRoutes,
  isAdmin,
  type UserWithPermissions,
  type Role,
} from "@/lib/authz/authz";

// Import authOptions - will be updated separately
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Get the current session or return null if not authenticated
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Get authenticated user with full role and permissions
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<UserWithPermissions | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id, active: true },
    select: {
      id: true,
      email: true,
      name: true,
      roleId: true,
    },
  });

  if (!user) return null;

  const role = await getRoleById(user.roleId);
  if (!role) return null;

  return {
    ...user,
    role,
  };
}

/**
 * Get authenticated user or throw error
 * Use this in API routes that require authentication
 */
export async function requireAuth(): Promise<UserWithPermissions> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

/**
 * Get authenticated user or redirect to login
 * Use this in page components that require authentication
 */
export async function requireAuthPage(callbackUrl?: string): Promise<UserWithPermissions> {
  const user = await getAuthenticatedUser();
  if (!user) {
    const params = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
    redirect(`/login${params}`);
  }
  return user;
}

/**
 * Check if user has a specific permission, throw if not
 */
export function assertPermission(
  user: UserWithPermissions,
  permissionName: string
): void {
  if (!userHasPermission(user, permissionName)) {
    throw new Error(`Permission denied: ${permissionName}`);
  }
}

/**
 * Check if user can perform an action on a resource, throw if not
 */
export function assertAction(
  user: UserWithPermissions,
  resource: string,
  action: string
): void {
  if (!userCanPerformAction(user, resource, action)) {
    throw new Error(`Permission denied: ${resource}:${action}`);
  }
}

/**
 * Check if user can access a route, throw if not
 */
export function assertRouteAccess(user: UserWithPermissions, routePath: string): void {
  if (!roleCanAccessRoute(user.role, routePath)) {
    throw new Error(`Access denied to route: ${routePath}`);
  }
}

/**
 * Require authentication and specific permission
 */
export async function requirePermission(
  permissionName: string
): Promise<UserWithPermissions> {
  const user = await requireAuth();
  assertPermission(user, permissionName);
  return user;
}

/**
 * Require authentication and specific action on resource
 */
export async function requireAction(
  resource: string,
  action: string
): Promise<UserWithPermissions> {
  const user = await requireAuth();
  assertAction(user, resource, action);
  return user;
}

/**
 * Require authentication and route access (for pages)
 */
export async function requireRouteAccess(
  routePath: string,
  callbackUrl?: string
): Promise<UserWithPermissions> {
  const user = await requireAuthPage(callbackUrl);

  // Admin can access all routes
  if (isAdmin(user)) {
    return user;
  }

  if (!roleCanAccessRoute(user.role, routePath)) {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Check if current user has permission (returns boolean)
 */
export async function canPerform(permissionName: string): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  return userHasPermission(user, permissionName);
}

/**
 * Check if current user can perform action on resource (returns boolean)
 */
export async function canPerformAction(
  resource: string,
  action: string
): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  return userCanPerformAction(user, resource, action);
}

/**
 * Check if current user can access a route (returns boolean)
 */
export async function canAccessRoute(routePath: string): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  return roleCanAccessRoute(user.role, routePath);
}

/**
 * Get all routes accessible by current user
 */
export async function getMyAccessibleRoutes(): Promise<string[]> {
  const user = await getAuthenticatedUser();
  if (!user) return [];
  return getAccessibleRoutes(user.role);
}

/**
 * Check if current user is admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  return isAdmin(user);
}

/**
 * Get current user's role
 */
export async function getCurrentUserRole(): Promise<Role | null> {
  const user = await getAuthenticatedUser();
  return user?.role || null;
}

/**
 * Get current user's default path
 */
export async function getCurrentUserDefaultPath(): Promise<string> {
  const user = await getAuthenticatedUser();
  return user?.role.defaultPath || "/";
}

/**
 * Authorization wrapper for API routes
 * Usage:
 * export const POST = withAuth(async (req, user) => { ... })
 */
export function withAuth(
  handler: (req: Request, user: UserWithPermissions) => Promise<Response>
) {
  return async (req: Request) => {
    try {
      const user = await requireAuth();
      return await handler(req, user);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}

/**
 * Authorization wrapper with permission check
 * Usage:
 * export const POST = withPermission("incidents:create", async (req, user) => { ... })
 */
export function withPermission(
  permissionName: string,
  handler: (req: Request, user: UserWithPermissions) => Promise<Response>
) {
  return withAuth(async (req, user) => {
    try {
      assertPermission(user, permissionName);
      return await handler(req, user);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  });
}

/**
 * Authorization wrapper with action check
 * Usage:
 * export const POST = withAction("incidents", "create", async (req, user) => { ... })
 */
export function withAction(
  resource: string,
  action: string,
  handler: (req: Request, user: UserWithPermissions) => Promise<Response>
) {
  return withAuth(async (req, user) => {
    try {
      assertAction(user, resource, action);
      return await handler(req, user);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  });
}
