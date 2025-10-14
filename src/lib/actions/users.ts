"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/security/hash";
import { redirect } from "next/navigation";

export type UserFormData = {
  name: string;
  email: string;
  password?: string;
  roleId: number;
  userStatusId: number;
  vicId?: string | null;
  telephone?: string;
  secondaryTelephone?: string;
  emergencyContact?: string;
  jobPosition?: string;
};

/**
 * Get all users with relations
 */
export async function getUsers() {
  await requirePermission("users:read");

  const users = await prisma.user.findMany({
    where: { active: true },
    include: {
      role: true,
      userStatus: true,
      vic: true,
      userProfile: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return users;
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
      vic: true,
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
      vicId: data.vicId || null,
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
      vic: true,
      userProfile: true,
    },
  });

  revalidatePath("/admin/users");
  return { success: true, data: user };
}

/**
 * Update existing user
 */
export async function updateUser(id: string, data: UserFormData) {
  await requirePermission("users:update");

  const updateData: any = {
    name: data.name,
    email: data.email,
    roleId: data.roleId,
    userStatusId: data.userStatusId,
    vicId: data.vicId || null,
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
      vic: true,
      userProfile: true,
    },
  });

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

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

/**
 * Get form options (roles, statuses, VICs)
 */
export async function getUserFormOptions() {
  await requirePermission("users:read");

  const [roles, statuses, vics] = await Promise.all([
    prisma.role.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.userStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.vehicleInspectionCenter.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { roles, statuses, vics };
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
      vic: true,
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
export async function updateMyPassword(currentPassword: string, newPassword: string) {
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
    userWithPassword.password
  );

  if (!isValidPassword) {
    throw new Error("Current password is incorrect");
  }

  // Hash and update new password
  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return { success: true };
}
