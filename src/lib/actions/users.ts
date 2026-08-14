"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { type requireAuth, requirePermission } from "@/lib/auth/auth";
import { clearPermissionsCache } from "@/lib/authz/authz";
import { assertCanManageRoles } from "@/lib/authz/role-assignment";
import { includeRoles } from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import { hashPassword } from "@/lib/security/hash";
import {
  assignUserToCliente,
  getPrimaryClienteId,
  removeUserFromCliente,
} from "@/lib/utils/cliente-assignments";
import { mxDayRange } from "@/lib/utils/datetime";
import { businessRule, guarded } from "./result";

export type UserFormData = {
  name: string;
  email: string;
  password?: string;
  /** A user holds many roles; the list replaces whatever they have today. */
  roleIds: number[];
  userStatusId: number;
  clienteId?: string | null;
  telephone?: string;
  secondaryTelephone?: string;
  emergencyContact?: string;
  jobPosition?: string;
  /** "YYYY-MM-DD" from the date input; drives vacation period accrual. */
  hireDate?: string | null;
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
        ...includeRoles,
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
      ...includeRoles,
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
  const caller = await requirePermission("users:create");

  return guarded(async () => {
    // Creating a user means granting access, so it is ROOT's call. Otherwise a
    // vacation administrator could mint an account holding every role and log
    // in as it — escalation with an extra step.
    assertCanManageRoles(caller);

    if (!data.password) {
      businessRule("La contraseña es obligatoria para usuarios nuevos.");
    }

    const roleIds = Array.from(new Set(data.roleIds ?? []));
    if (roleIds.length === 0) {
      businessRule("Selecciona al menos un rol para el usuario.");
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        userRoles: { create: roleIds.map((roleId) => ({ roleId })) },
        userStatusId: data.userStatusId,
        hireDate: parseHireDate(data.hireDate),
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
        ...includeRoles,
        userStatus: true,
        cliente: true,
        userProfile: true,
      },
    });

    // Assign Cliente via UserClienteAssignment if provided
    if (data.clienteId) {
      await assignUserToCliente(user.id, data.clienteId, true);
    }

    // Backfill vacation periods so the balance panel is populated immediately
    // rather than only after the user's first page visit.
    if (user.hireDate) {
      const { ensurePeriodsUpToNow } = await import(
        "@/lib/services/vacation-periods"
      );
      await ensurePeriodsUpToNow(user.id);
    }

    revalidatePath("/admin/users");
    return { data: user };
  });
}

/** Normalize a "YYYY-MM-DD" hire date to the CDMX start of that day. */
function parseHireDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return mxDayRange(value).gte;
}

/**
 * Update existing user
 */
export async function updateUser(id: string, data: UserFormData) {
  const caller = await requirePermission("users:update");

  return guarded(async () => updateUserInner(caller, id, data));
}

async function updateUserInner(
  caller: Awaited<ReturnType<typeof requireAuth>>,
  id: string,
  data: UserFormData,
) {
  // Get current user to detect role/status/hire-date changes
  const currentUser = await prisma.user.findUnique({
    where: { id },
    select: {
      userStatusId: true,
      hireDate: true,
      userRoles: { where: { active: true }, select: { roleId: true } },
    },
  });

  const currentRoleIds = (currentUser?.userRoles ?? []).map((ur) => ur.roleId);
  const nextRoleIds = Array.from(new Set(data.roleIds ?? []));
  const rolesChanged =
    nextRoleIds.length > 0 &&
    (nextRoleIds.length !== currentRoleIds.length ||
      nextRoleIds.some((roleId) => !currentRoleIds.includes(roleId)));

  // Editing someone's phone number is ordinary user administration; changing
  // which roles they hold is not. Only the second is gated, so a module admin
  // keeps a useful form instead of being locked out of the whole screen — and
  // the attempt is refused out loud rather than silently dropped.
  if (rolesChanged) {
    assertCanManageRoles(caller);
    if (caller.id === id) {
      businessRule("No puedes cambiar tus propios roles.");
    }
  }

  const updateData: Prisma.UserUpdateInput = {
    name: data.name,
    email: data.email,
    userStatus: { connect: { id: data.userStatusId } },
  };

  // Only update password if provided. Bump sessionVersion so any existing
  // session for this user is forced to re-authenticate, same as when a
  // user changes their own password via updateMyPassword.
  if (data.password) {
    updateData.password = await hashPassword(data.password);
    updateData.sessionVersion = { increment: 1 };
  }

  // Hire date drives every vacation period, so a correction has to move the
  // existing windows with it. `recomputePeriodsForNewHireDate` refuses the
  // change if it would strand a vacation someone already booked, which is what
  // makes editing a mistyped date safe rather than destructive.
  const nextHireDate = parseHireDate(data.hireDate);
  const hireDateChanged =
    nextHireDate?.getTime() !== currentUser?.hireDate?.getTime();

  if (hireDateChanged) {
    updateData.hireDate = nextHireDate;

    if (nextHireDate === null) {
      const periodsWithVacations = await prisma.vacationPeriod.count({
        where: { userId: id, vacations: { some: { active: true } } },
      });
      if (periodsWithVacations > 0) {
        businessRule(
          "No se puede quitar la fecha de contratación: el usuario tiene solicitudes de vacaciones registradas.",
        );
      }
      await prisma.vacationPeriod.deleteMany({ where: { userId: id } });
    } else if (currentUser?.hireDate) {
      const { recomputePeriodsForNewHireDate } = await import(
        "@/lib/services/vacation-periods"
      );
      await recomputePeriodsForNewHireDate(id, nextHireDate);
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: {
      ...includeRoles,
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

  // Apply the role change itself. Route grants travel in the JWT, so this also
  // bumps sessionVersion — without it the person keeps their old menu and old
  // access until the token expires.
  if (rolesChanged) {
    await prisma.$transaction(async (tx) => {
      await tx.userRole.updateMany({
        where: { userId: id, roleId: { notIn: nextRoleIds } },
        data: { active: false },
      });
      for (const roleId of nextRoleIds) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: id, roleId } },
          update: { active: true },
          create: { userId: id, roleId, active: true },
        });
      }
    });
    clearPermissionsCache();
  }

  // Invalidate session if roles or status changed
  if (
    rolesChanged ||
    (currentUser && currentUser.userStatusId !== data.userStatusId)
  ) {
    const { invalidateUserSessions } = await import(
      "@/lib/auth/session-management"
    );
    await invalidateUserSessions(id);
  }

  // Create the periods a newly-set hire date has already earned.
  if (hireDateChanged && nextHireDate) {
    const { ensurePeriodsUpToNow } = await import(
      "@/lib/services/vacation-periods"
    );
    await ensurePeriodsUpToNow(id);
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/vacations");
  revalidatePath("/vacations");
  return { data: user };
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
      ...includeRoles,
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

  return guarded(async () => {
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
      businessRule("La contraseña actual es incorrecta.");
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

    return {};
  });
}
