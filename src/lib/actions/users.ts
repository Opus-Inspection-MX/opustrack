"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { hashPassword } from "@/lib/security/hash";
import {
  assignUserToCliente,
  getPrimaryClienteId,
  removeUserFromCliente,
} from "@/lib/utils/cliente-assignments";

export type UserFormData = {
  name: string;
  email: string;
  password?: string;
  roleId: number;
  userStatusId: number;
  clienteId?: string | null;
  telephone?: string;
  secondaryTelephone?: string;
  emergencyContact?: string;
  jobPosition?: string;
};

type GetUsersParams = {
  page?: number;
  limit?: number;
  search?: string;
};

/**
 * Get users with pagination and optional search (name, email, or id).
 */
export async function getUsers(params?: GetUsersParams) {
  await requirePermission("users:read");

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const skip = (page - 1) * limit;
  const search = params?.search?.trim();

  const where = search
    ? {
        active: true,
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { id: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : { active: true };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        role: true,
        userStatus: true,
        cliente: true,
        userProfile: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get single user by ID
 */
export async function getUserById(id: string) {
  await requirePermission("users:read");

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      role: true,
      userStatus: true,
      cliente: true,
      userProfile: true,
    },
  });

  return user;
}

/**
 * Create new user
 */
export async function createUser(data: UserFormData) {
  await requirePermission("users:create");

  if (!data.password) {
    throw new Error("Password is required for new users");
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      roleId: data.roleId,
      userStatusId: data.userStatusId,
      userProfile: {
        create: {
          telephone: data.telephone || null,
          secondaryTelephone: data.secondaryTelephone || null,
          emergencyContact: data.emergencyContact || null,
          jobPosition: data.jobPosition || null,
        },
      },
    },
    include: {
      role: true,
      userStatus: true,
      cliente: true,
      userProfile: true,
    },
  });

  // Assign Cliente via UserClienteAssignment if provided
  if (data.clienteId) {
    await assignUserToCliente(user.id, data.clienteId, true);
  }

  revalidatePath("/admin/users");
  return { success: true, data: user };
}

/**
 * Update existing user
 */
export async function updateUser(id: string, data: UserFormData) {
  await requirePermission("users:update");

  // Get current user to detect role/status changes
  const currentUser = await prisma.user.findUnique({
    where: { id },
    select: { roleId: true, userStatusId: true },
  });

  const updateData: Prisma.UserUpdateInput = {
    name: data.name,
    email: data.email,
    role: { connect: { id: data.roleId } },
    userStatus: { connect: { id: data.userStatusId } },
  };

  // Only update password if provided
  if (data.password) {
    updateData.password = await hashPassword(data.password);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: {
      role: true,
      userStatus: true,
      cliente: true,
      userProfile: true,
    },
  });

  // Manage Cliente assignment via UserClienteAssignment
  const currentClienteId = await getPrimaryClienteId(id);
  if (data.clienteId && data.clienteId !== currentClienteId) {
    // Cliente changed: remove old, assign new
    if (currentClienteId) {
      await removeUserFromCliente(id, currentClienteId);
    }
    await assignUserToCliente(id, data.clienteId, true);
  } else if (!data.clienteId && currentClienteId) {
    // Cliente cleared: remove old
    await removeUserFromCliente(id, currentClienteId);
  }

  // Update or create user profile
  await prisma.userProfile.upsert({
    where: { userId: id },
    create: {
      userId: id,
      telephone: data.telephone || null,
      secondaryTelephone: data.secondaryTelephone || null,
      emergencyContact: data.emergencyContact || null,
      jobPosition: data.jobPosition || null,
    },
    update: {
      telephone: data.telephone || null,
      secondaryTelephone: data.secondaryTelephone || null,
      emergencyContact: data.emergencyContact || null,
      jobPosition: data.jobPosition || null,
    },
  });

  // Invalidate session if role or status changed
  if (
    currentUser &&
    (currentUser.roleId !== data.roleId ||
      currentUser.userStatusId !== data.userStatusId)
  ) {
    const { invalidateUserSessions } = await import(
      "@/lib/auth/session-management"
    );
    await invalidateUserSessions(id);
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { success: true, data: user };
}

/**
 * Delete user (soft delete)
 */
export async function deleteUser(id: string) {
  await requirePermission("users:delete");

  await prisma.user.update({
    where: { id },
    data: { active: false },
  });

  // Invalidate sessions so deleted user is immediately logged out
  const { invalidateUserSessions } = await import(
    "@/lib/auth/session-management"
  );
  await invalidateUserSessions(id);

  revalidatePath("/admin/users");
  return { success: true };
}

/**
 * Get form options (roles, statuses, Clientes)
 */
export async function getUserFormOptions() {
  await requirePermission("users:read");

  const [roles, statuses, clientes] = await Promise.all([
    prisma.role.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.userStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.cliente.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { roles, statuses, clientes };
}

/**
 * Get current user's profile
 */
export async function getMyProfile() {
  const { requireAuth } = await import("@/lib/auth/auth");
  const user = await requireAuth();

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      role: true,
      userStatus: true,
      cliente: true,
      userProfile: true,
    },
  });

  return profile;
}

/**
 * Update current user's profile (own profile only)
 */
export async function updateMyProfile(data: {
  name: string;
  telephone?: string;
  secondaryTelephone?: string;
  emergencyContact?: string;
  jobPosition?: string;
}) {
  const { requireAuth } = await import("@/lib/auth/auth");
  const user = await requireAuth();

  // Update user name
  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
    },
  });

  // Update or create user profile
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      telephone: data.telephone || null,
      secondaryTelephone: data.secondaryTelephone || null,
      emergencyContact: data.emergencyContact || null,
      jobPosition: data.jobPosition || null,
    },
    update: {
      telephone: data.telephone || null,
      secondaryTelephone: data.secondaryTelephone || null,
      emergencyContact: data.emergencyContact || null,
      jobPosition: data.jobPosition || null,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/admin/profile");
  return { success: true };
}

/**
 * Update current user's password
 */
export async function updateMyPassword(
  currentPassword: string,
  newPassword: string,
) {
  const { requireAuth } = await import("@/lib/auth/auth");
  const user = await requireAuth();

  // Get user with password
  const userWithPassword = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });

  if (!userWithPassword) {
    throw new Error("User not found");
  }

  // Verify current password
  const bcrypt = await import("bcrypt");
  const isValidPassword = await bcrypt.compare(
    currentPassword,
    userWithPassword.password,
  );

  if (!isValidPassword) {
    throw new Error("Current password is incorrect");
  }

  // Hash and update new password. Bump sessionVersion to invalidate every
  // existing JWT for this user: after a password change, any previously issued
  // session (including a stolen one) must be forced to re-authenticate.
  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      sessionVersion: { increment: 1 },
    },
  });

  return { success: true };
}
