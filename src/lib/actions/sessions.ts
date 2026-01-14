"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import {
  invalidateMultipleUserSessions,
  invalidateRoleSessions,
  invalidateUserSessions,
} from "@/lib/auth/session-management";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * Invalidate all sessions for a specific user
 * Forces the user to re-login on their next request
 */
export async function forceLogoutUser(userId: string) {
  await requirePermission("users:update");

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  await invalidateUserSessions(userId);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);

  return {
    success: true,
    message: `User ${user.email} will be logged out on their next request`,
  };
}

/**
 * Invalidate sessions for all users with a specific role
 * Useful when role permissions are changed
 */
export async function forceLogoutByRole(roleId: number) {
  await requirePermission("roles:update");

  // Verify role exists
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true },
  });

  if (!role) {
    throw new Error("Role not found");
  }

  await invalidateRoleSessions(roleId);

  revalidatePath("/admin/roles");

  return {
    success: true,
    message: `All users with role ${role.name} will be logged out on their next request`,
  };
}

/**
 * Invalidate sessions for multiple users
 */
export async function forceLogoutUsers(userIds: string[]) {
  await requirePermission("users:update");

  if (userIds.length === 0) {
    return { success: true, message: "No users specified" };
  }

  await invalidateMultipleUserSessions(userIds);

  revalidatePath("/admin/users");

  return {
    success: true,
    message: `${userIds.length} user(s) will be logged out on their next request`,
  };
}

/**
 * Update user role and invalidate their sessions
 * This ensures the role change takes effect immediately
 */
export async function updateUserRoleWithSessionInvalidation(
  userId: string,
  newRoleId: number,
) {
  await requirePermission("users:update");

  // Verify role exists
  const role = await prisma.role.findUnique({
    where: { id: newRoleId },
    select: { id: true, name: true, defaultPath: true },
  });

  if (!role) {
    throw new Error("Role not found");
  }

  // Update role and invalidate session in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        roleId: newRoleId,
        sessionVersion: { increment: 1 }, // Invalidate session
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);

  return {
    success: true,
    message: `User role updated to ${role.name}. User will be logged out on their next request.`,
  };
}

/**
 * Deactivate user and invalidate their sessions
 * This ensures the user is immediately locked out
 */
export async function deactivateUserWithSessionInvalidation(userId: string) {
  await requirePermission("users:update");

  await prisma.$transaction(async (tx) => {
    // Get inactive status
    const inactiveStatus = await tx.userStatus.findFirst({
      where: { name: "INACTIVO" },
    });

    if (!inactiveStatus) {
      throw new Error("INACTIVO status not found");
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        userStatusId: inactiveStatus.id,
        sessionVersion: { increment: 1 }, // Invalidate session
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);

  return {
    success: true,
    message: "User deactivated and logged out",
  };
}
