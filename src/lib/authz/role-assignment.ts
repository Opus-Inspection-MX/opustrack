import { businessRule } from "@/lib/actions/result";
import type { UserAuthz } from "@/lib/authz/authz";
import { clearPermissionsCache } from "@/lib/authz/authz";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * Who may hand out access, and how it is handed out.
 *
 * Granting a role is the one operation that can create more power than the
 * caller has, so it is gated on `isSuperuser` (ROOT) rather than on a
 * permission. A permission would be grantable — and an administrator who can
 * grant themselves the permission that lets them grant permissions is not an
 * administrator, it is a second root.
 */

/** Only ROOT administers roles, permissions and who holds them. */
export function assertCanManageRoles(caller: UserAuthz): void {
  if (!caller.isSuperuser) {
    businessRule(
      "Solo un usuario ROOT puede administrar roles y permisos. Pídeselo a un administrador general.",
    );
  }
}

/**
 * Replace a user's roles.
 *
 * Bumps `sessionVersion`, which is what makes the change land: route grants
 * travel in the JWT, so without the bump the person would keep their old menu
 * and their old access until the token expired. `getAuthenticatedUser` already
 * rejects a session whose version drifted, so they simply log in again.
 */
export async function setUserRoles(
  caller: UserAuthz & { id: string },
  userId: string,
  roleIds: number[],
): Promise<void> {
  assertCanManageRoles(caller);

  if (caller.id === userId) {
    businessRule("No puedes cambiar tus propios roles.");
  }

  const unique = Array.from(new Set(roleIds));
  if (unique.length === 0) {
    // A user with zero roles cannot authenticate at all, which looks like a
    // broken account rather than a revoked one. Deactivate the user instead.
    businessRule("El usuario debe conservar al menos un rol.");
  }

  const roles = await prisma.role.findMany({
    where: { id: { in: unique }, active: true },
    select: { id: true },
  });
  if (roles.length !== unique.length) {
    businessRule("Uno o más roles no existen o están inactivos.");
  }

  await prisma.$transaction(async (tx) => {
    // Deactivate rather than delete, so revoking and re-granting a role keeps
    // one row and its history instead of accumulating duplicates.
    await tx.userRole.updateMany({
      where: { userId, roleId: { notIn: unique } },
      data: { active: false },
    });

    for (const roleId of unique) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId } },
        update: { active: true },
        create: { userId, roleId, active: true },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
  });

  clearPermissionsCache();
}
