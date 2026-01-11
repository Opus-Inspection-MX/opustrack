/**
 * Data Filtering Helpers for Multi-tenancy
 *
 * These helpers ensure users only see data from their assigned VIC(s),
 * except for ADMINISTRADOR who can see all data.
 *
 * CRITICAL: Always use these filters in queries to prevent data leakage
 * between different VICs.
 */

import type { UserWithPermissions } from "@/lib/authz/authz";

/**
 * Returns WHERE clause for filtering by VIC
 *
 * - ADMINISTRADOR: No filter (can see all VICs)
 * - Other roles: Filter by their assigned vicId
 * - Users without VIC: Filter by vicId: null
 *
 * @param user - The authenticated user with role information
 * @returns Prisma WHERE clause for vicId filtering
 *
 * @example
 * ```typescript
 * const user = await requirePermission("incidents:read");
 * const vicFilter = getVicWhereClause(user);
 *
 * const incidents = await prisma.incident.findMany({
 *   where: {
 *     active: true,
 *     ...vicFilter,  // Apply VIC filter
 *   }
 * });
 * ```
 */
export function getVicWhereClause(user: UserWithPermissions): {
  vicId?: string | { equals: null };
} {
  // Admin can see everything
  if (isAdmin(user)) {
    return {};
  }

  // Users without VIC assignment can only see records without VIC
  if (!user.vicId) {
    return { vicId: { equals: null } };
  }

  // Filter by user's assigned VIC
  return { vicId: user.vicId };
}

/**
 * Helper for checking if user is admin
 *
 * @param user - The user to check
 * @returns true if user has ADMINISTRADOR role
 */
export function isAdmin(user: UserWithPermissions): boolean {
  return user.role?.name === "ADMINISTRADOR";
}

/**
 * Check if user can access a specific VIC's data
 *
 * @param user - The authenticated user
 * @param vicId - The VIC ID to check access for
 * @returns true if user can access the VIC
 *
 * @example
 * ```typescript
 * const canAccess = canAccessVic(user, incident.vicId);
 * if (!canAccess) {
 *   throw new Error("Cannot access data from this VIC");
 * }
 * ```
 */
export function canAccessVic(
  user: UserWithPermissions,
  vicId: string | null,
): boolean {
  // Admin can access all VICs
  if (isAdmin(user)) {
    return true;
  }

  // User without VIC can only access null VIC data
  if (!user.vicId) {
    return vicId === null;
  }

  // User can access their own VIC
  return user.vicId === vicId;
}

/**
 * Throws error if user cannot access the specified VIC
 *
 * @param user - The authenticated user
 * @param vicId - The VIC ID to verify access for
 * @throws Error if user cannot access the VIC
 *
 * @example
 * ```typescript
 * const incident = await prisma.incident.findUnique({ where: { id } });
 * assertVicAccess(user, incident.vicId);
 * // Continues only if user has access
 * ```
 */
export function assertVicAccess(
  user: UserWithPermissions,
  vicId: string | null,
): void {
  if (!canAccessVic(user, vicId)) {
    throw new Error(
      "Access denied: You do not have permission to access data from this VIC",
    );
  }
}
