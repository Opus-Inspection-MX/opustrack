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
