/**
 * Data Filtering Helpers for Multi-tenancy
 *
 * These helpers ensure users only see data from their assigned Client(s),
 * except for holders of the cross-Client scope permission who can see all data.
 *
 * CRITICAL: Always use these filters in queries to prevent data leakage
 * between different Clients.
 *
 * All variants are async and multi-Client: they resolve every Client
 * assignment of the user. (A synchronous single-Client path used to exist
 * here; it silently dropped secondary assignments and was removed.)
 */

import { businessRule } from "@/lib/actions/result";
import {
  SCOPE_ALL_CLIENTS,
  type UserWithPermissions,
  userHasPermission,
} from "@/lib/authz/authz";
import { getUserClientIds } from "@/lib/utils/client-assignments";
import { clientInScope } from "./access";

/**
 * Returns WHERE clause for filtering by Client (async - supports multi-Client)
 *
 * - Scope holders: No filter (can see all Clients)
 * - Other roles: Filter by all their assigned Clients
 * - Users without Client assignments: Filter by clientId: null
 *
 * @param user - The authenticated user with role information
 * @returns Prisma WHERE clause for clientId filtering (using IN for multiple Clients)
 *
 * @example
 * ```typescript
 * const user = await requirePermission("incidents:read");
 * const clientFilter = await getClientWhereClauseAsync(user);
 *
 * const incidents = await prisma.incident.findMany({
 *   where: {
 *     active: true,
 *     ...clientFilter,  // Apply Client filter
 *   }
 * });
 * ```
 */
export async function getClientWhereClauseAsync(
  user: UserWithPermissions,
): Promise<{
  clientId?: string | { in: string[] } | { equals: null };
}> {
  // Admin can see everything
  if (isAdmin(user)) {
    return {};
  }

  // Get all Client IDs assigned to the user
  const clientIds = await getUserClientIds(user.id);

  // Users without Client assignments can only see records without Client.
  // (The deprecated User.clienteId scalar fallback died with the column:
  // the junction table is the only source of truth.)
  if (clientIds.length === 0) {
    return { clientId: { equals: null } };
  }

  // Single Client - use direct filter
  if (clientIds.length === 1) {
    return { clientId: clientIds[0] };
  }

  // Multiple Clients - use IN filter
  return { clientId: { in: clientIds } };
}

/**
 * Whether the user's data scope spans every Client.
 *
 * This is NOT "is a superuser". `ADMINISTRADOR` used to mean both, and keeping
 * them fused would force an operations admin — who must see every center — to
 * also hold the keys to roles and permissions. ROOT keeps it implicitly; anyone
 * else needs the permission granted.
 */
export function isAdmin(user: UserWithPermissions): boolean {
  return userHasPermission(user, SCOPE_ALL_CLIENTS);
}

/**
 * Check if user can access a specific Client's data (async - supports multi-Client)
 *
 * Single fail-closed rule in `auth/access.ts`: a `null` Client is only
 * reachable with an unrestricted scope, and a user with no assignments
 * matches nothing (H-05). This function keeps its signature and delegates.
 *
 * @param user - The authenticated user
 * @param clientId - The Client ID to check access for
 * @returns true if user can access the Client
 *
 * @example
 * ```typescript
 * const canAccess = await canAccessClientAsync(user, incident.clientId);
 * if (!canAccess) {
 *   businessRule("Sin acceso a los datos de este Cliente.");
 * }
 * ```
 */
export async function canAccessClientAsync(
  user: UserWithPermissions,
  clientId: string | null,
): Promise<boolean> {
  // Admin can access all Clients
  if (isAdmin(user)) {
    return true;
  }

  const clientIds = await getUserClientIds(user.id);
  return clientInScope({ clientIds }, clientId);
}

/**
 * Raises a business rule if user cannot access the specified Client (async - supports multi-Client)
 *
 * Operator-facing denial via `businessRule(...)`, converted to a returned
 * rejection by `guarded(...)`.
 *
 * @param user - The authenticated user
 * @param clientId - The Client ID to verify access for
 *
 * @example
 * ```typescript
 * const incident = await prisma.incident.findUnique({ where: { id } });
 * await assertClientAccessAsync(user, incident.clientId);
 * // Continues only if user has access
 * ```
 */
export async function assertClientAccessAsync(
  user: UserWithPermissions,
  clientId: string | null,
): Promise<void> {
  const hasAccess = await canAccessClientAsync(user, clientId);
  if (!hasAccess) {
    businessRule("Sin acceso a los datos de este Cliente.");
  }
}
