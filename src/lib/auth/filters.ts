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
 * @param user - The authenticated user
 * @param clientId - The Client ID to check access for
 * @returns true if user can access the Client
 *
 * @example
 * ```typescript
 * const canAccess = await canAccessClientAsync(user, incident.clientId);
 * if (!canAccess) {
 *   businessRule("Sin acceso a los datos de este Cliente");
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

  // Null Client data requires null Client user
  if (clientId === null) {
    const clientIds = await getUserClientIds(user.id);
    return clientIds.length === 0;
  }

  // Check if user is assigned to this Client
  const clientIds = await getUserClientIds(user.id);

  // Check Client assignments first
  if (clientIds.includes(clientId)) {
    return true;
  }

  return false;
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
    businessRule("Sin acceso a los datos de este Cliente");
  }
}
