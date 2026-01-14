/**
 * Data Filtering Helpers for Multi-tenancy
 *
 * These helpers ensure users only see data from their assigned VIC(s),
 * except for ADMINISTRADOR who can see all data.
 *
 * CRITICAL: Always use these filters in queries to prevent data leakage
 * between different VICs.
 *
 * Multi-VIC Support:
 * - Use getVicWhereClause() for synchronous filtering (uses primary vicId from session)
 * - Use getVicWhereClauseAsync() for async filtering (queries all VIC assignments)
 */

import type { UserWithPermissions } from "@/lib/authz/authz";
import { getUserVicIds } from "@/lib/utils/vic-assignments";

/**
 * Returns WHERE clause for filtering by VIC (synchronous - uses primary vicId)
 *
 * - ADMINISTRADOR: No filter (can see all VICs)
 * - Other roles: Filter by their primary vicId
 * - Users without VIC: Filter by vicId: null
 *
 * NOTE: For multi-VIC support, use getVicWhereClauseAsync() instead.
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
 * Returns WHERE clause for filtering by VIC (async - supports multi-VIC)
 *
 * - ADMINISTRADOR: No filter (can see all VICs)
 * - Other roles: Filter by all their assigned VICs
 * - Users without VIC assignments: Filter by vicId: null
 *
 * @param user - The authenticated user with role information
 * @returns Prisma WHERE clause for vicId filtering (using IN for multiple VICs)
 *
 * @example
 * ```typescript
 * const user = await requirePermission("incidents:read");
 * const vicFilter = await getVicWhereClauseAsync(user);
 *
 * const incidents = await prisma.incident.findMany({
 *   where: {
 *     active: true,
 *     ...vicFilter,  // Apply VIC filter
 *   }
 * });
 * ```
 */
export async function getVicWhereClauseAsync(user: UserWithPermissions): Promise<{
  vicId?: string | { in: string[] } | { equals: null };
}> {
  // Admin can see everything
  if (isAdmin(user)) {
    return {};
  }

  // Get all VIC IDs assigned to the user
  const vicIds = await getUserVicIds(user.id);

  // Users without VIC assignments can only see records without VIC
  if (vicIds.length === 0) {
    // Fall back to legacy vicId if available
    if (user.vicId) {
      return { vicId: user.vicId };
    }
    return { vicId: { equals: null } };
  }

  // Single VIC - use direct filter
  if (vicIds.length === 1) {
    return { vicId: vicIds[0] };
  }

  // Multiple VICs - use IN filter
  return { vicId: { in: vicIds } };
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
 * Check if user can access a specific VIC's data (synchronous - uses primary vicId)
 *
 * NOTE: For multi-VIC support, use canAccessVicAsync() instead.
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
 * Check if user can access a specific VIC's data (async - supports multi-VIC)
 *
 * @param user - The authenticated user
 * @param vicId - The VIC ID to check access for
 * @returns true if user can access the VIC
 *
 * @example
 * ```typescript
 * const canAccess = await canAccessVicAsync(user, incident.vicId);
 * if (!canAccess) {
 *   throw new Error("Cannot access data from this VIC");
 * }
 * ```
 */
export async function canAccessVicAsync(
  user: UserWithPermissions,
  vicId: string | null,
): Promise<boolean> {
  // Admin can access all VICs
  if (isAdmin(user)) {
    return true;
  }

  // Null VIC data requires null VIC user
  if (vicId === null) {
    const vicIds = await getUserVicIds(user.id);
    return vicIds.length === 0 && !user.vicId;
  }

  // Check if user is assigned to this VIC
  const vicIds = await getUserVicIds(user.id);

  // Check VIC assignments first
  if (vicIds.includes(vicId)) {
    return true;
  }

  // Fall back to legacy vicId
  return user.vicId === vicId;
}

/**
 * Throws error if user cannot access the specified VIC (synchronous)
 *
 * NOTE: For multi-VIC support, use assertVicAccessAsync() instead.
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

/**
 * Throws error if user cannot access the specified VIC (async - supports multi-VIC)
 *
 * @param user - The authenticated user
 * @param vicId - The VIC ID to verify access for
 * @throws Error if user cannot access the VIC
 *
 * @example
 * ```typescript
 * const incident = await prisma.incident.findUnique({ where: { id } });
 * await assertVicAccessAsync(user, incident.vicId);
 * // Continues only if user has access
 * ```
 */
export async function assertVicAccessAsync(
  user: UserWithPermissions,
  vicId: string | null,
): Promise<void> {
  const hasAccess = await canAccessVicAsync(user, vicId);
  if (!hasAccess) {
    throw new Error(
      "Access denied: You do not have permission to access data from this VIC",
    );
  }
}
