// src/lib/auth/auth.ts

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cache } from "react";
import { BusinessRuleError } from "@/lib/actions/result";
import { authOptions } from "@/lib/auth/auth-options";
import {
  getAccessibleRoutes,
  getUserAuthz,
  isSuperuser,
  type Role,
  type UserWithPermissions,
  userCanAccessRoute,
  userCanPerformAction,
  userHasPermission,
} from "@/lib/authz/authz";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";

/**
 * Authorization denial (RF-557).
 *
 * Thrown when a caller is authenticated but not allowed: missing permission,
 * forbidden action, or route outside their grants. Wrappers translate this
 * into a 403 WITHOUT an error log — a denial is routine traffic, not a
 * defect. Every other exception from a handler is a genuine fault: 500 +
 * `logger.error`.
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Next.js `redirect()`/`notFound()` control-flow throws must propagate. */
function isFrameworkRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Business rules and framework redirects keep their contract: they
 * propagate, never log. Everything else reaching this point is a fault.
 */
function shouldPropagate(error: unknown): boolean {
  return error instanceof BusinessRuleError || isFrameworkRedirect(error);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Get the current session or return null if not authenticated
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Get authenticated user with full role and permissions
 * Returns null if not authenticated or if session is invalidated
 *
 * Session validation:
 * - Checks if user's sessionVersion matches JWT
 * - If not, forces re-authentication
 *
 * Wrapped in React cache() for request-level memoization: multiple auth helpers
 * (requireRouteAccess, canPerform, getMyAccessibleRoutes, ...) called during a
 * single render now share ONE getServerSession + user query instead of repeating.
 */
export const getAuthenticatedUser = cache(
  async (): Promise<UserWithPermissions | null> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id, active: true },
      select: {
        id: true,
        email: true,
        name: true,
        sessionVersion: true,
        userStatus: { select: { name: true } },
      },
    });

    if (!user) return null;

    // Status is checked on EVERY request, not only at sign-in. The login path
    // already refuses a non-ACTIVO account, but someone suspended while their
    // session was open kept it until the JWT expired — up to 30 days of access
    // after being locked out.
    if (user.userStatus?.name !== "ACTIVO") {
      logger.debug("auth.session_rejected", {
        userId: user.id,
        status: user.userStatus?.name,
      });
      return null;
    }

    // Validate session version (if JWT has version)
    const jwtVersion = session.user.sessionVersion;
    if (jwtVersion !== undefined && user.sessionVersion !== jwtVersion) {
      // Session has been invalidated - user needs to re-login
      logger.debug("auth.session_version_mismatch", { userId: user.id });
      return null;
    }

    // Union of every active role. A user stripped of all roles resolves to
    // null rather than to an empty permission set, so they cannot hold a
    // session that looks valid but authorizes nothing.
    const authz = await getUserAuthz(user.id);
    if (!authz) return null;

    return { ...user, ...authz };
  },
);

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
export async function requireAuthPage(
  callbackUrl?: string,
): Promise<UserWithPermissions> {
  const user = await getAuthenticatedUser();
  if (!user) {
    const params = callbackUrl
      ? `?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "";
    redirect(`/login${params}`);
  }
  return user;
}

/**
 * Check if user has a specific permission, throw if not
 */
export function assertPermission(
  user: UserWithPermissions,
  permissionName: string,
): void {
  if (!userHasPermission(user, permissionName)) {
    throw new AuthorizationError(`Permission denied: ${permissionName}`);
  }
}

/**
 * Check if user can perform an action on a resource, throw if not
 */
export function assertAction(
  user: UserWithPermissions,
  resource: string,
  action: string,
): void {
  if (!userCanPerformAction(user, resource, action)) {
    throw new AuthorizationError(`Permission denied: ${resource}:${action}`);
  }
}

/**
 * Check if user can access a route, throw if not
 */
export function assertRouteAccess(
  user: UserWithPermissions,
  routePath: string,
): void {
  if (!userCanAccessRoute(user, routePath)) {
    throw new AuthorizationError(`Access denied to route: ${routePath}`);
  }
}

/**
 * Require authentication and specific permission
 */
export async function requirePermission(
  permissionName: string,
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
  action: string,
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
  callbackUrl?: string,
): Promise<UserWithPermissions> {
  const user = await requireAuthPage(callbackUrl);

  // Admin can access all routes
  if (isSuperuser(user)) {
    return user;
  }

  if (!userCanAccessRoute(user, routePath)) {
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
  action: string,
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
  return userCanAccessRoute(user, routePath);
}

/**
 * Get all routes accessible by current user
 */
export async function getMyAccessibleRoutes(): Promise<string[]> {
  const user = await getAuthenticatedUser();
  if (!user) return [];
  return getAccessibleRoutes(user);
}

/**
 * Check if current user is admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  return isSuperuser(user);
}

/**
 * Get current user's roles.
 *
 * Plural: a user can administer vacations, administer operations and still be
 * an FSR. Callers that need "the" role want `getCurrentUserDefaultPath` or a
 * permission check instead.
 */
export async function getCurrentUserRoles(): Promise<Role[]> {
  const user = await getAuthenticatedUser();
  return user?.roles ?? [];
}

/**
 * Get current user's default path
 */
export async function getCurrentUserDefaultPath(): Promise<string> {
  const user = await getAuthenticatedUser();
  return user?.defaultPath || "/";
}

/**
 * Authorization wrapper for API routes
 * Usage:
 * export const POST = withAuth(async (req, user) => { ... })
 *
 * Split (RF-557): a missing/invalid session is 401; a fault thrown by the
 * handler is 500 + `logger.error`. Faults used to surface as 401, hiding
 * production breakage behind "Unauthorized".
 */
export function withAuth(
  handler: (req: Request, user: UserWithPermissions) => Promise<Response>,
) {
  return async (req: Request) => {
    let user: UserWithPermissions;
    try {
      user = await requireAuth();
    } catch {
      return jsonError("Unauthorized", 401);
    }
    try {
      return await handler(req, user);
    } catch (error) {
      if (shouldPropagate(error)) throw error;
      logger.error("api.handler_fault", { error });
      return jsonError("Internal server error", 500);
    }
  };
}

/**
 * Authorization wrapper with permission check
 * Usage:
 * export const POST = withPermission("incidents:create", async (req, user) => { ... })
 *
 * Split (RF-557): denial is 403 with a generic body and no error log (the
 * permission name stays out of the response); only genuine handler faults
 * are 500 and logged. Business rules and redirects propagate untouched.
 */
export function withPermission(
  permissionName: string,
  handler: (req: Request, user: UserWithPermissions) => Promise<Response>,
) {
  return async (req: Request) => {
    let user: UserWithPermissions;
    try {
      user = await requireAuth();
    } catch {
      return jsonError("Unauthorized", 401);
    }
    try {
      assertPermission(user, permissionName);
      return await handler(req, user);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        logger.debug("api.authorization_denied", {
          permission: permissionName,
        });
        return jsonError("Forbidden", 403);
      }
      if (shouldPropagate(error)) throw error;
      logger.error("api.handler_fault", { permission: permissionName, error });
      return jsonError("Internal server error", 500);
    }
  };
}

/**
 * Authorization wrapper with action check
 * Usage:
 * export const POST = withAction("incidents", "create", async (req, user) => { ... })
 *
 * Same 403/500 split as `withPermission` (RF-557).
 */
export function withAction(
  resource: string,
  action: string,
  handler: (req: Request, user: UserWithPermissions) => Promise<Response>,
) {
  return async (req: Request) => {
    let user: UserWithPermissions;
    try {
      user = await requireAuth();
    } catch {
      return jsonError("Unauthorized", 401);
    }
    try {
      assertAction(user, resource, action);
      return await handler(req, user);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        logger.debug("api.authorization_denied", {
          resource,
          action,
        });
        return jsonError("Forbidden", 403);
      }
      if (shouldPropagate(error)) throw error;
      logger.error("api.handler_fault", { resource, action, error });
      return jsonError("Internal server error", 500);
    }
  };
}
