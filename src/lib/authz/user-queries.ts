/**
 * Prisma fragments for querying users by role or permission.
 *
 * A user's roles live in the `user_roles` join table, so every "the FSRs" or
 * "the admins" query needs a nested `some`. These helpers keep that shape in
 * one place: the alternative is ~15 hand-written `userRoles: { some: ... }`
 * blocks that quietly disagree about whether they filter on `active`.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma.singleton";

/** Users holding a role by name. */
export function whereHasRole(roleName: string): Prisma.UserWhereInput {
  return {
    userRoles: {
      some: { active: true, role: { name: roleName, active: true } },
    },
  };
}

/**
 * Users holding a permission through ANY of their roles.
 *
 * Prefer this over `whereHasRole` when picking an audience. "Notify the admins"
 * used to mean `role.name === "ADMINISTRADOR"`; now that admin is split by
 * module, naming the capability is what keeps incident alerts away from the
 * vacation administrators.
 */
export function whereHasPermission(
  permissionName: string,
): Prisma.UserWhereInput {
  return {
    userRoles: {
      some: {
        active: true,
        role: {
          active: true,
          rolePermission: {
            some: {
              active: true,
              permission: { name: permissionName, active: true },
            },
          },
        },
      },
    },
  };
}

/** Load a user's roles alongside the user. */
export const includeRoles = {
  userRoles: {
    where: { active: true },
    include: { role: true },
  },
} as const;

/** Flatten what `includeRoles` returns into plain role names. */
export function roleNamesOf(user: {
  userRoles?: Array<{ role: { name: string } }>;
}): string[] {
  return (user.userRoles ?? []).map((ur) => ur.role.name);
}

/** Ids of active users holding a permission — the audience for a notification. */
export async function getUserIdsWithPermission(
  permissionName: string,
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { active: true, ...whereHasPermission(permissionName) },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Ids of active users holding a role by name. */
export async function getUserIdsWithRole(roleName: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { active: true, ...whereHasRole(roleName) },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Users holding a role by id — the id-shaped twin of `whereHasRole`. */
export function whereHasRoleId(roleId: number): Prisma.UserWhereInput {
  return {
    userRoles: { some: { active: true, roleId, role: { active: true } } },
  };
}
