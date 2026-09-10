/**
 * Data Filtering Helpers for Multi-tenancy
 *
 * These helpers ensure users only see data from their assigned Cliente(s),
 * except for holders of the cross-Cliente scope permission who can see all data.
 *
 * CRITICAL: Always use these filters in queries to prevent data leakage
 * between different Clientes.
 *
 * All variants are async and multi-Cliente: they resolve every Cliente
 * assignment of the user. (A synchronous single-Cliente path used to exist
 * here; it silently dropped secondary assignments and was removed.)
 */

import { businessRule } from "@/lib/actions/result";
import {
  SCOPE_ALL_CLIENTES,
  type UserWithPermissions,
  userHasPermission,
} from "@/lib/authz/authz";
import { getUserClienteIds } from "@/lib/utils/cliente-assignments";

/**
 * Returns WHERE clause for filtering by Cliente (async - supports multi-Cliente)
 *
 * - Scope holders: No filter (can see all Clientes)
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

  // Users without Cliente assignments can only see records without Cliente.
  // (The deprecated User.clienteId scalar fallback died with the column:
  // the junction table is the only source of truth.)
  if (clienteIds.length === 0) {
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
 * Whether the user's data scope spans every Cliente.
 *
 * This is NOT "is a superuser". `ADMINISTRADOR` used to mean both, and keeping
 * them fused would force an operations admin — who must see every center — to
 * also hold the keys to roles and permissions. ROOT keeps it implicitly; anyone
 * else needs the permission granted.
 */
export function isAdmin(user: UserWithPermissions): boolean {
  return userHasPermission(user, SCOPE_ALL_CLIENTES);
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
 *   businessRule("Sin acceso a los datos de este Cliente");
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
    return clienteIds.length === 0;
  }

  // Check if user is assigned to this Cliente
  const clienteIds = await getUserClienteIds(user.id);

  // Check Cliente assignments first
  if (clienteIds.includes(clienteId)) {
    return true;
  }

  return false;
}

/**
 * Raises a business rule if user cannot access the specified Cliente (async - supports multi-Cliente)
 *
 * Operator-facing denial via `businessRule(...)`, converted to a returned
 * rejection by `guarded(...)`.
 *
 * @param user - The authenticated user
 * @param clienteId - The Cliente ID to verify access for
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
    businessRule("Sin acceso a los datos de este Cliente");
  }
}
