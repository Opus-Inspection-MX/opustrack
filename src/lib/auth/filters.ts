/**
 * Data Filtering Helpers for Multi-tenancy
 *
 * These helpers ensure users only see data from their assigned Cliente(s),
 * except for ADMINISTRADOR who can see all data.
 *
 * CRITICAL: Always use these filters in queries to prevent data leakage
 * between different Clientes.
 *
 * Multi-Cliente Support:
 * - Use getClienteWhereClause() for synchronous filtering (uses primary clienteId from session)
 * - Use getClienteWhereClauseAsync() for async filtering (queries all Cliente assignments)
 */

import type { UserWithPermissions } from "@/lib/authz/authz";
import { getUserClienteIds } from "@/lib/utils/cliente-assignments";

/**
 * Returns WHERE clause for filtering by Cliente (synchronous - uses primary clienteId)
 *
 * - ADMINISTRADOR: No filter (can see all Clientes)
 * - Other roles: Filter by their primary clienteId
 * - Users without Cliente: Filter by clienteId: null
 *
 * NOTE: For multi-Cliente support, use getClienteWhereClauseAsync() instead.
 *
 * @param user - The authenticated user with role information
 * @returns Prisma WHERE clause for clienteId filtering
 *
 * @example
 * ```typescript
 * const user = await requirePermission("incidents:read");
 * const clienteFilter = getClienteWhereClause(user);
 *
 * const incidents = await prisma.incident.findMany({
 *   where: {
 *     active: true,
 *     ...clienteFilter,  // Apply Cliente filter
 *   }
 * });
 * ```
 */
export function getClienteWhereClause(user: UserWithPermissions): {
  clienteId?: string | { equals: null };
} {
  // Admin can see everything
  if (isAdmin(user)) {
    return {};
  }

  // Users without Cliente assignment can only see records without Cliente
  if (!user.clienteId) {
    return { clienteId: { equals: null } };
  }

  // Filter by user's assigned Cliente
  return { clienteId: user.clienteId };
}

/**
 * Returns WHERE clause for filtering by Cliente (async - supports multi-Cliente)
 *
 * - ADMINISTRADOR: No filter (can see all Clientes)
 * - Other roles: Filter by all their assigned Clientes
 * - Users without Cliente assignments: Filter by clienteId: null
 *
 * @param user - The authenticated user with role information
 * @returns Prisma WHERE clause for clienteId filtering (using IN for multiple Clientes)
 *
 * @example
 * ```typescript
 * const user = await requirePermission("incidents:read");
 * const clienteFilter = await getClienteWhereClauseAsync(user);
 *
 * const incidents = await prisma.incident.findMany({
 *   where: {
 *     active: true,
 *     ...clienteFilter,  // Apply Cliente filter
 *   }
 * });
 * ```
 */
export async function getClienteWhereClauseAsync(
  user: UserWithPermissions,
): Promise<{
  clienteId?: string | { in: string[] } | { equals: null };
}> {
  // Admin can see everything
  if (isAdmin(user)) {
    return {};
  }

  // Get all Cliente IDs assigned to the user
  const clienteIds = await getUserClienteIds(user.id);

  // Users without Cliente assignments can only see records without Cliente
  if (clienteIds.length === 0) {
    // Fall back to legacy clienteId if available
    if (user.clienteId) {
      return { clienteId: user.clienteId };
    }
    return { clienteId: { equals: null } };
  }

  // Single Cliente - use direct filter
  if (clienteIds.length === 1) {
    return { clienteId: clienteIds[0] };
  }

  // Multiple Clientes - use IN filter
  return { clienteId: { in: clienteIds } };
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
 * Check if user can access a specific Cliente's data (synchronous - uses primary clienteId)
 *
 * NOTE: For multi-Cliente support, use canAccessClienteAsync() instead.
 *
 * @param user - The authenticated user
 * @param clienteId - The Cliente ID to check access for
 * @returns true if user can access the Cliente
 *
 * @example
 * ```typescript
 * const canAccess = canAccessCliente(user, incident.clienteId);
 * if (!canAccess) {
 *   throw new Error("Cannot access data from this Cliente");
 * }
 * ```
 */
export function canAccessCliente(
  user: UserWithPermissions,
  clienteId: string | null,
): boolean {
  // Admin can access all Clientes
  if (isAdmin(user)) {
    return true;
  }

  // User without Cliente can only access null Cliente data
  if (!user.clienteId) {
    return clienteId === null;
  }

  // User can access their own Cliente
  return user.clienteId === clienteId;
}

/**
 * Check if user can access a specific Cliente's data (async - supports multi-Cliente)
 *
 * @param user - The authenticated user
 * @param clienteId - The Cliente ID to check access for
 * @returns true if user can access the Cliente
 *
 * @example
 * ```typescript
 * const canAccess = await canAccessClienteAsync(user, incident.clienteId);
 * if (!canAccess) {
 *   throw new Error("Cannot access data from this Cliente");
 * }
 * ```
 */
export async function canAccessClienteAsync(
  user: UserWithPermissions,
  clienteId: string | null,
): Promise<boolean> {
  // Admin can access all Clientes
  if (isAdmin(user)) {
    return true;
  }

  // Null Cliente data requires null Cliente user
  if (clienteId === null) {
    const clienteIds = await getUserClienteIds(user.id);
    return clienteIds.length === 0 && !user.clienteId;
  }

  // Check if user is assigned to this Cliente
  const clienteIds = await getUserClienteIds(user.id);

  // Check Cliente assignments first
  if (clienteIds.includes(clienteId)) {
    return true;
  }

  // Fall back to legacy clienteId
  return user.clienteId === clienteId;
}

/**
 * Throws error if user cannot access the specified Cliente (synchronous)
 *
 * NOTE: For multi-Cliente support, use assertClienteAccessAsync() instead.
 *
 * @param user - The authenticated user
 * @param clienteId - The Cliente ID to verify access for
 * @throws Error if user cannot access the Cliente
 *
 * @example
 * ```typescript
 * const incident = await prisma.incident.findUnique({ where: { id } });
 * assertClienteAccess(user, incident.clienteId);
 * // Continues only if user has access
 * ```
 */
export function assertClienteAccess(
  user: UserWithPermissions,
  clienteId: string | null,
): void {
  if (!canAccessCliente(user, clienteId)) {
    throw new Error(
      "Access denied: You do not have permission to access data from this Cliente",
    );
  }
}

/**
 * Throws error if user cannot access the specified Cliente (async - supports multi-Cliente)
 *
 * @param user - The authenticated user
 * @param clienteId - The Cliente ID to verify access for
 * @throws Error if user cannot access the Cliente
 *
 * @example
 * ```typescript
 * const incident = await prisma.incident.findUnique({ where: { id } });
 * await assertClienteAccessAsync(user, incident.clienteId);
 * // Continues only if user has access
 * ```
 */
export async function assertClienteAccessAsync(
  user: UserWithPermissions,
  clienteId: string | null,
): Promise<void> {
  const hasAccess = await canAccessClienteAsync(user, clienteId);
  if (!hasAccess) {
    throw new Error(
      "Access denied: You do not have permission to access data from this Cliente",
    );
  }
}
