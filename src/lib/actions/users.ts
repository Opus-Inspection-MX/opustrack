"use server";

import type { Prisma } from "@prisma/client";
import { AuditAction, AuditEntity } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/log-audit";
import { type requireAuth, requirePermission } from "@/lib/auth/auth";
import { clearPermissionsCache } from "@/lib/authz/authz";
import { assertCanManageRoles } from "@/lib/authz/role-assignment";
import { includeRoles } from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import { hashPassword } from "@/lib/security/hash";
import {
  assignUserToClient,
  getPrimaryClientId,
  removeUserFromClient,
} from "@/lib/utils/client-assignments";
import { mxDayRange } from "@/lib/utils/datetime";
import { type ActionResult, businessRule, guarded, ok } from "./result";

export type UserFormData = {
  name: string;
  email: string;
  password?: string;
  /** A user holds many roles; the list replaces whatever they have today. */
  roleIds: number[];
  userStatusId: number;
  clientId?: string | null;
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

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        ...includeRoles,
        userStatus: true,
        ...primaryClientInclude,
        userProfile: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({ ...row, client: primaryClientOf(row) })),
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
/** Shape the pages render for a user's Client (`row.client.name`). */
type ClientRef = { id: string; name: string; code: string };

const primaryClientInclude = {
  clientAssignments: {
    where: { active: true },
    include: {
      client: { select: { id: true, name: true, code: true } },
    },
    orderBy: { isPrimary: "desc" as const },
  },
};

/**
 * The junction table is the only source of truth for Client membership
 * (the deprecated User.clienteId scalar is gone). Pages still render a
 * singular `client`, so each query maps the primary assignment onto that
 * shape: primary first, else the first active assignment, else null.
 */
function primaryClientOf(row: {
  clientAssignments: Array<{ isPrimary: boolean; client: ClientRef }>;
}): ClientRef | null {
  return (
    row.clientAssignments.find((a) => a.isPrimary)?.client ??
    row.clientAssignments[0]?.client ??
    null
  );
}

export async function getUserById(id: string) {
  await requirePermission("users:read");

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      ...includeRoles,
      userStatus: true,
      userProfile: true,
      ...primaryClientInclude,
    },
  });

  if (!user) return user;

  // Pages render a singular `client` and the form edits a singular
  // `clientId`: both derive from the assignments now that the deprecated
  // scalar is gone.
  const client = primaryClientOf(user);
  return { ...user, client, clientId: client?.id ?? null };
}

/**
 * Create new user
 */

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
        ...primaryClientInclude,
        userProfile: true,
      },
    });

    // Assign Client via UserClientAssignment if provided
    if (data.clientId) {
      await assignUserToClient(user.id, data.clientId, true);
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
    return { data: { ...user, client: primaryClientOf(user) } };
  });
}

/** Normalize a "YYYY-MM-DD" hire date to the CDMX start of that day. */
function parseHireDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return mxDayRange(value).gte;
}

/** Earliest hire date the employment capture accepts. */
const MIN_HIRE_YEAR = 1950;

/**
 * Validate a "YYYY-MM-DD" hire date for employment capture.
 *
 * Present, well-formed, not in the future, and not before 1950. Rules are
 * raised (never thrown as defects) so the operator reads them in production.
 */
function parseEmploymentHireDate(value: string | null | undefined): Date {
  if (!value) {
    businessRule("La fecha de contratación es obligatoria.");
  }
  const parsed = mxDayRange(value).gte;
  if (Number.isNaN(parsed.getTime())) {
    businessRule("La fecha de contratación no es válida.");
  }
  if (parsed.getTime() > Date.now()) {
    businessRule("La fecha de contratación no puede ser futura.");
  }
  if (parsed.getFullYear() < MIN_HIRE_YEAR) {
    businessRule("La fecha de contratación no puede ser anterior a 1950.");
  }
  return parsed;
}

/**
 * Move a user's vacation periods along with a hire-date change, and write
 * the user row itself.
 *
 * Hire date drives every vacation period, so a correction has to move the
 * existing windows with it. `recomputePeriodsForNewHireDate` refuses the
 * change if it would strand a vacation someone already booked, which is what
 * makes editing a mistyped date safe rather than destructive.
 *
 * Shared by `updateUser` (ROOT form) and `updateUserEmployment` (vacation
 * admin): the same correction must never behave differently depending on who
 * typed it. No duplication of the accrual logic.
 */
async function applyHireDateChange(
  userId: string,
  currentHireDate: Date | null,
  nextHireDate: Date | null,
): Promise<void> {
  const hireDateChanged =
    nextHireDate?.getTime() !== currentHireDate?.getTime();
  if (!hireDateChanged) return;

  if (nextHireDate === null) {
    const periodsWithVacations = await prisma.vacationPeriod.count({
      where: { userId, vacations: { some: { active: true } } },
    });
    if (periodsWithVacations > 0) {
      businessRule(
        "No se puede quitar la fecha de contratación: el usuario tiene solicitudes de vacaciones registradas.",
      );
    }
    await prisma.vacationPeriod.deleteMany({ where: { userId } });
  } else if (currentHireDate) {
    const { recomputePeriodsForNewHireDate } = await import(
      "@/lib/services/vacation-periods"
    );
    await recomputePeriodsForNewHireDate(userId, nextHireDate);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { hireDate: nextHireDate },
  });

  // Create the periods a newly-set hire date has already earned.
  if (nextHireDate) {
    const { ensurePeriodsUpToNow } = await import(
      "@/lib/services/vacation-periods"
    );
    await ensurePeriodsUpToNow(userId);
  }
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

  // Hire date drives every vacation period: delegate to the shared helper so
  // a correction here behaves exactly like one captured by the vacation
  // administrator. The helper writes the user row itself.
  const nextHireDate = parseHireDate(data.hireDate);
  if (nextHireDate?.getTime() !== currentUser?.hireDate?.getTime()) {
    await applyHireDateChange(id, currentUser?.hireDate ?? null, nextHireDate);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: {
      ...includeRoles,
      userStatus: true,
      ...primaryClientInclude,
      userProfile: true,
    },
  });

  // Manage Client assignment via UserClientAssignment
  const currentClientId = await getPrimaryClientId(id);
  if (data.clientId && data.clientId !== currentClientId) {
    // Client changed: remove old, assign new
    if (currentClientId) {
      await removeUserFromClient(id, currentClientId);
    }
    await assignUserToClient(id, data.clientId, true);
  } else if (!data.clientId && currentClientId) {
    // Client cleared: remove old
    await removeUserFromClient(id, currentClientId);
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

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/vacations");
  revalidatePath("/vacations");
  return { data: { ...user, client: primaryClientOf(user) } };
}

export type UserEmploymentData = {
  /** "YYYY-MM-DD" from the date input. Required: this action never clears. */
  hireDate: string;
};

/**
 * Capture a user's hire date without full user administration.
 *
 * The vacation administrator (`users:manage-employment`) sets the date that
 * drives vacation accrual from `/admin/vacations`. Roles, passwords, status
 * and Client assignment stay ROOT-only. Period recalculation is the shared
 * `applyHireDateChange` helper, so a date captured here behaves exactly like
 * one typed in the ROOT user form.
 */
export async function updateUserEmployment(
  userId: string,
  data: UserEmploymentData,
) {
  const caller = await requirePermission("users:manage-employment");

  return guarded(async () => {
    const nextHireDate = parseEmploymentHireDate(data.hireDate);

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { hireDate: true, active: true },
    });
    if (!target || !target.active) {
      businessRule("No encontrado.");
    }

    if (nextHireDate.getTime() === target.hireDate?.getTime()) {
      return {};
    }

    await applyHireDateChange(userId, target.hireDate, nextHireDate);

    await logAudit(prisma, {
      actorId: caller.id,
      entity: AuditEntity.USER,
      entityId: userId,
      action: AuditAction.UPDATE,
      payload: {
        hireDate: nextHireDate.toISOString(),
        reason: "hire-date-capture",
      },
    });

    revalidatePath("/admin/vacations");
    revalidatePath("/vacations");
    revalidatePath(`/admin/users/${userId}`);
    return {};
  });
}

/**
 * Get form options (roles, statuses, Clients)
 */
export async function deleteUser(id: string): Promise<ActionResult> {
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
  return ok();
}

/**
 * Get form options (roles, statuses, Clientes)
 */
export async function getUserFormOptions() {
  await requirePermission("users:read");

  const [roles, statuses, clients] = await Promise.all([
    prisma.role.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.userStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { roles, statuses, clients };
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
      ...primaryClientInclude,
      userProfile: true,
    },
  });

  if (!profile) return profile;
  return { ...profile, client: primaryClientOf(profile) };
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
  return ok();
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
