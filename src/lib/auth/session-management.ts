/**
 * Session Management Utilities
 *
 * Provides session invalidation functionality using JWT version numbers.
 * When a user's sessionVersion changes, their JWT becomes invalid and they're forced to re-login.
 *
 * How it works:
 * 1. User logs in → JWT includes current sessionVersion
 * 2. Admin changes permissions/role → sessionVersion is incremented
 * 3. Next request → validateSession() detects version mismatch → redirect to login
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * Validates that the user's session version matches the database.
 * Call this in protected pages/actions to ensure session is still valid.
 *
 * @param userId - The user's ID from JWT
 * @param jwtSessionVersion - The session version stored in the JWT
 * @returns The user if valid, or redirects to login
 *
 * @example
 * ```typescript
 * const user = await getServerSession();
 * await validateSession(user.id, user.sessionVersion);
 * // Continues only if session is valid
 * ```
 */
export async function validateSession(
  userId: string,
  jwtSessionVersion: number | undefined,
): Promise<boolean> {
  if (!jwtSessionVersion) {
    // Old JWT without version - consider valid for backward compatibility
    return true;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true, active: true },
  });

  if (!user) {
    return false;
  }

  // Check if user is deactivated
  if (!user.active) {
    return false;
  }

  // Check version match
  return user.sessionVersion === jwtSessionVersion;
}

/**
 * Validates session and redirects to login if invalid.
 * Use this in protected pages to force re-authentication.
 *
 * @param userId - The user's ID from JWT
 * @param jwtSessionVersion - The session version stored in the JWT
 */
export async function validateSessionOrRedirect(
  userId: string,
  jwtSessionVersion: number | undefined,
): Promise<void> {
  const isValid = await validateSession(userId, jwtSessionVersion);

  if (!isValid) {
    redirect("/login?expired=true");
  }
}

/**
 * Invalidate all sessions for a user by incrementing their session version.
 * This will force the user to re-login on their next request.
 *
 * @param userId - The user ID to invalidate sessions for
 *
 * @example
 * ```typescript
 * // After changing a user's role
 * await updateUserRole(userId, newRoleId);
 * await invalidateUserSessions(userId);
 * ```
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      sessionVersion: { increment: 1 },
    },
  });

  console.log(`[SESSION] Invalidated all sessions for user ${userId}`);
}

/**
 * Invalidate sessions for all users with a specific role.
 * Useful when role permissions are changed.
 *
 * @param roleId - The role ID whose users should have sessions invalidated
 *
 * @example
 * ```typescript
 * // After changing role permissions
 * await updateRolePermissions(roleId, newPermissions);
 * await invalidateRoleSessions(roleId);
 * ```
 */
export async function invalidateRoleSessions(roleId: number): Promise<void> {
  const result = await prisma.user.updateMany({
    where: { roleId, active: true },
    data: {
      sessionVersion: { increment: 1 },
    },
  });

  console.log(
    `[SESSION] Invalidated sessions for ${result.count} users with role ${roleId}`,
  );
}

/**
 * Invalidate sessions for multiple users at once.
 *
 * @param userIds - Array of user IDs to invalidate sessions for
 */
export async function invalidateMultipleUserSessions(
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;

  const result = await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: {
      sessionVersion: { increment: 1 },
    },
  });

  console.log(`[SESSION] Invalidated sessions for ${result.count} users`);
}

/**
 * Get the current session version for a user.
 *
 * @param userId - The user ID
 * @returns The current session version
 */
export async function getUserSessionVersion(
  userId: string,
): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });

  return user?.sessionVersion ?? null;
}
