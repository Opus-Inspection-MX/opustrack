"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { isAdmin } from "@/lib/authz/authz";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  notifyVacationApproved,
  notifyVacationRejected,
  notifyVacationRequested,
} from "@/lib/notifications";
import {
  allottedDaysFor,
  ensurePeriodsUpToNow,
  getPeriodBalance,
  resolveVacationPeriod,
} from "@/lib/services/vacation-periods";
import { getHolidayDatesForYear } from "@/lib/utils/availability";
import { mxDayRange } from "@/lib/utils/datetime";
import { countBusinessDays } from "@/lib/utils/vacation-balance";
import {
  type VacationFormData,
  validateVacationDates,
} from "@/lib/validations/vacations";
import { businessRule, guarded, rejected } from "./result";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get active vacations, optionally filtered by statusId.
 *
 * ADMIN sees every request; anyone else sees only their own. `vacations:read`
 * is granted to FSR so they can manage their own requests (RF-706), so the
 * permission alone must not expose other people's `reason`.
 */
export async function getVacations(statusId?: number) {
  const caller = await requirePermission("vacations:read");

  const vacations = await prisma.vacation.findMany({
    where: {
      active: true,
      ...(statusId !== undefined ? { statusId } : {}),
      ...(isAdmin(caller) ? {} : { userId: caller.id }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      status: true,
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return vacations;
}

/**
 * Get vacations for the currently authenticated FSR (own only).
 */
export async function getMyVacations() {
  const user = await requirePermission("vacations:read");

  const vacations = await prisma.vacation.findMany({
    where: { userId: user.id, active: true },
    include: {
      status: true,
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return vacations;
}

/**
 * Get a single vacation by ID.
 *
 * Ownership is enforced in the query itself: a non-admin can only resolve their
 * own request. Returns null rather than another user's record.
 */
export async function getVacationById(id: string) {
  const caller = await requirePermission("vacations:read");

  const vacation = await prisma.vacation.findFirst({
    where: {
      id,
      ...(isAdmin(caller) ? {} : { userId: caller.id }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      status: true,
      approvedBy: { select: { id: true, name: true } },
    },
  });

  return vacation;
}

/**
 * Get active FSR users available for the vacation FSR-select dropdown.
 * Only available to users who can create vacations.
 */
export async function getFsrsForVacations() {
  await requirePermission("vacations:create");

  const fsrs = await prisma.user.findMany({
    where: {
      active: true,
      role: { name: "FSR" },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return fsrs;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Create a vacation request.
 *
 * - Target user: data.userId if provided (admin-on-behalf); otherwise caller.
 * - If data.userId is provided and differs from caller, caller must be ADMIN.
 * - Resolves the vacation period the range belongs to and charges its balance.
 * - Validates no active PENDIENTE or APROBADA vacation overlaps the range.
 * - New vacations are created in PENDIENTE status.
 *
 * The balance check and the insert share a transaction: two requests racing for
 * the last remaining day must not both pass the check. That is also why the
 * rules inside raise `businessRule` instead of returning — returning from a
 * transaction callback commits it.
 */
export async function createVacation(data: VacationFormData) {
  const caller = await requirePermission("vacations:create");

  validateVacationDates(data);

  // Normalize the picked calendar dates to CDMX day bounds so single-day and
  // multi-day vacations cover the full Mexico City day. The HTML date input
  // yields a UTC-midnight Date whose ISO date is the day the user picked.
  const startDate = mxDayRange(data.startDate.toISOString().slice(0, 10)).gte;
  const endDate = mxDayRange(data.endDate.toISOString().slice(0, 10)).lte;

  // Resolve target user
  const targetUserId = data.userId ?? caller.id;

  if (targetUserId !== caller.id && !isAdmin(caller)) {
    return rejected(
      "No tiene permisos para crear vacaciones en nombre de otro usuario.",
    );
  }

  const result = await guarded(async () => {
    // Resolve PENDIENTE status id
    const pendienteStatus = await prisma.vacationStatus.findFirst({
      where: { name: "PENDIENTE", active: true },
      select: { id: true },
    });

    if (!pendienteStatus) {
      throw new Error(
        "Estado 'PENDIENTE' no encontrado. Verifique la configuración del sistema.",
      );
    }

    const blockingStatuses = await prisma.vacationStatus.findMany({
      where: { name: { in: ["PENDIENTE", "APROBADA"] }, active: true },
      select: { id: true },
    });
    const blockingStatusIds = blockingStatuses.map((s) => s.id);

    // Weekends and holidays are free, so this is usually fewer days than the
    // calendar span. Computed outside the transaction: it only reads the
    // holiday catalog and is the slowest part of the request.
    const businessDaysUsed = await countBusinessDays(startDate, endDate);

    if (businessDaysUsed === 0) {
      businessRule(
        "El rango solicitado no incluye ningún día hábil (solo fines de semana o días festivos).",
      );
    }

    const vacation = await prisma.$transaction(async (tx) => {
      const period = await resolveVacationPeriod(
        targetUserId,
        startDate,
        endDate,
        tx,
        data.periodId,
      );

      const { remainingDays } = await getPeriodBalance(period.id, tx);
      if (businessDaysUsed > remainingDays) {
        businessRule(
          `La solicitud requiere ${businessDaysUsed} día(s) hábil(es), pero el período ${period.periodNumber} solo tiene ${remainingDays} día(s) disponible(s).`,
        );
      }

      const overlap = await tx.vacation.findFirst({
        where: {
          userId: targetUserId,
          active: true,
          statusId: { in: blockingStatusIds },
          // Inclusive overlap: existing.startDate <= newEnd AND existing.endDate >= newStart
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      });

      if (overlap) {
        businessRule(
          "El período solicitado se superpone con una solicitud de vacaciones pendiente o aprobada existente.",
        );
      }

      return tx.vacation.create({
        data: {
          userId: targetUserId,
          startDate,
          endDate,
          reason: data.reason ?? null,
          statusId: pendienteStatus.id,
          periodId: period.id,
          businessDaysUsed,
        },
      });
    });

    return { data: vacation };
  });

  if (result.success) {
    // Admins otherwise have no signal that something is waiting for them.
    const requester = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true },
    });
    await notifyVacationRequested(result.data.id, requester?.name, caller.id);

    revalidatePath("/admin/vacations");
    revalidatePath("/fsr/vacations");
  }

  return result;
}

/**
 * Apply a terminal decision to a PENDIENTE vacation.
 *
 * Guards, in order: the request must still be active (a soft-deleted request
 * must not become APROBADA and start blocking assignments), and it must be in
 * PENDIENTE — a decision is taken once, so an already resolved request cannot
 * be flipped or have its `approvedAt` overwritten.
 */
async function resolveVacation(
  id: string,
  target: "APROBADA" | "RECHAZADA",
  approverId: string,
) {
  const status = await prisma.vacationStatus.findFirst({
    where: { name: target, active: true },
    select: { id: true },
  });

  if (!status) {
    throw new Error(`Estado '${target}' no encontrado.`);
  }

  const existing = await prisma.vacation.findUnique({
    where: { id },
    select: {
      active: true,
      userId: true,
      status: { select: { name: true } },
    },
  });

  if (!existing || !existing.active) {
    throw new Error("Solicitud de vacaciones no encontrada.");
  }

  if (existing.status.name !== "PENDIENTE") {
    return rejected(
      `La solicitud ya fue resuelta (${existing.status.name}). Solo se puede decidir sobre solicitudes pendientes.`,
    );
  }

  // No balance re-check is needed here. A PENDIENTE request already reserves
  // its days (getPeriodBalance counts PENDIENTE and APROBADA alike), so
  // approving consumes nothing new and rejecting frees them by dropping the
  // request out of that sum.
  const vacation = await prisma.vacation.update({
    where: { id },
    data: {
      statusId: status.id,
      approvedById: approverId,
      approvedAt: new Date(),
    },
  });

  if (target === "APROBADA") {
    await notifyVacationApproved(vacation.id, existing.userId, approverId);
  } else {
    await notifyVacationRejected(vacation.id, existing.userId, approverId);
  }

  revalidatePath("/admin/vacations");
  revalidatePath("/fsr/vacations");
  return { success: true, data: vacation };
}

export interface VacationAssignmentConflict {
  assignmentId: string;
  folio: number;
  scheduledDate: Date;
  incidentTitle: string;
}

/**
 * Assignments the FSR is already scheduled for inside a vacation's dates.
 *
 * Approving a vacation makes `isFsrUnavailable` start blocking those days, but
 * it does not touch work that was scheduled beforehand — that assignment would
 * silently sit on a day its FSR is now away. Nothing is reassigned
 * automatically (who should take over is a human decision), so this exists to
 * put the conflict in front of the admin before they approve.
 *
 * Closed assignments are excluded: the work already happened, so there is
 * nothing left to reschedule.
 */
export async function getVacationApprovalConflicts(
  vacationId: string,
): Promise<VacationAssignmentConflict[]> {
  await requirePermission("vacations:approve");

  const vacation = await prisma.vacation.findUnique({
    where: { id: vacationId },
    select: { userId: true, startDate: true, endDate: true },
  });
  if (!vacation) return [];

  const assignments = await prisma.assignment.findMany({
    where: {
      active: true,
      scheduledDate: { gte: vacation.startDate, lte: vacation.endDate },
      assignees: { some: { userId: vacation.userId, active: true } },
      status: { name: { not: "CERRADO" } },
    },
    select: {
      id: true,
      folio: true,
      scheduledDate: true,
      incident: { select: { title: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });

  return assignments.map((assignment) => ({
    assignmentId: assignment.id,
    folio: assignment.folio,
    // Narrowed by the query's scheduledDate filter.
    scheduledDate: assignment.scheduledDate as Date,
    incidentTitle: assignment.incident.title,
  }));
}

/**
 * Approve a vacation (ADMIN only — requires vacations:approve).
 * Sets status to APROBADA and records approvedById and approvedAt.
 *
 * Scheduling conflicts are surfaced by `getVacationApprovalConflicts` before
 * this is called; they warn rather than block, because an admin may well
 * intend to approve and reassign the work afterwards.
 */
export async function approveVacation(id: string) {
  const approver = await requirePermission("vacations:approve");
  return resolveVacation(id, "APROBADA", approver.id);
}

/**
 * Reject a vacation (ADMIN only — requires vacations:approve).
 * Sets status to RECHAZADA and records approvedById and approvedAt.
 */
export async function rejectVacation(id: string) {
  const approver = await requirePermission("vacations:approve");
  return resolveVacation(id, "RECHAZADA", approver.id);
}

/**
 * Soft-delete a vacation.
 * FSR can only delete their own; ADMIN can delete any.
 */
export async function deleteVacation(id: string) {
  const caller = await requirePermission("vacations:delete");

  // FSR ownership check
  if (!isAdmin(caller)) {
    const vacation = await prisma.vacation.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!vacation) {
      throw new Error("Solicitud de vacaciones no encontrada.");
    }

    if (vacation.userId !== caller.id) {
      return rejected(
        "Solo puede eliminar sus propias solicitudes de vacaciones.",
      );
    }
  }

  await prisma.vacation.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/vacations");
  revalidatePath("/fsr/vacations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export interface VacationPeriodSummary {
  id: string;
  periodNumber: number;
  accrualStart: Date;
  accrualEnd: Date;
  graceEnd: Date;
  allottedDays: number;
  usedDays: number;
  remainingDays: number;
  isOverridden: boolean;
  isExpired: boolean;
}

/**
 * Everything the balance panel and year calendar need for one user.
 *
 * Periods are created lazily here: with no job runner, a page load is what
 * notices that someone's work anniversary has passed.
 *
 * `hasHireDate` is returned rather than throwing so the UI can show the real
 * reason the panel is empty instead of a generic error.
 */
export async function getVacationBalanceData(userId?: string, year?: number) {
  const caller = await requirePermission("vacations:read");

  const targetUserId = userId ?? caller.id;
  if (targetUserId !== caller.id && !isAdmin(caller)) {
    return rejected(
      "No tiene permisos para consultar el saldo de otro usuario.",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, hireDate: true },
  });
  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  const targetYear = year ?? new Date().getFullYear();

  if (!user.hireDate) {
    return {
      success: true as const,
      user,
      hasHireDate: false,
      periods: [] as VacationPeriodSummary[],
      vacations: [],
      holidayDates: [] as string[],
      year: targetYear,
    };
  }

  const periods = await ensurePeriodsUpToNow(targetUserId);
  const now = new Date();

  const summaries: VacationPeriodSummary[] = await Promise.all(
    periods.map(async (period) => {
      const balance = await getPeriodBalance(period.id);
      return {
        id: period.id,
        periodNumber: period.periodNumber,
        accrualStart: period.accrualStart,
        accrualEnd: period.accrualEnd,
        graceEnd: period.graceEnd,
        ...balance,
        isOverridden: period.overrideDays !== null,
        // A lapsed period is plain history: it simply stops accepting requests.
        isExpired: period.graceEnd < now,
      };
    }),
  );

  // The calendar shows a whole year, so fetch every request that touches it.
  const { gte } = mxDayRange(`${targetYear}-01-01`);
  const { lte } = mxDayRange(`${targetYear}-12-31`);

  const vacations = await prisma.vacation.findMany({
    where: {
      userId: targetUserId,
      active: true,
      startDate: { lte },
      endDate: { gte },
    },
    include: { status: { select: { name: true, color: true } } },
    orderBy: { startDate: "asc" },
  });

  const holidayDates = await getHolidayDatesForYear(targetYear);

  return {
    success: true as const,
    user,
    hasHireDate: true,
    periods: summaries,
    vacations,
    holidayDates: [...holidayDates],
    year: targetYear,
  };
}

/**
 * Override how many days a period grants.
 *
 * Safe by construction: the balance is derived, so raising this can only ever
 * increase what is available. No existing request is touched or revalidated —
 * which is exactly the requirement that adding days must never unassign
 * vacations somebody already booked.
 *
 * Passing null drops the override and falls back to the accrual table.
 */
export async function updatePeriodOverride(
  periodId: string,
  overrideDays: number | null,
) {
  await requirePermission("vacations:manage");

  return guarded(async () => {
    if (overrideDays !== null) {
      if (!Number.isInteger(overrideDays) || overrideDays < 0) {
        businessRule("Los días asignados deben ser un número entero positivo.");
      }
      if (overrideDays > 365) {
        businessRule("Los días asignados no pueden exceder 365.");
      }
    }

    const period = await prisma.vacationPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) {
      throw new Error("Período vacacional no encontrado.");
    }

    // Lowering the allotment below what is already booked would leave the
    // period overdrawn. Refuse rather than silently showing a negative balance.
    const { usedDays } = await getPeriodBalance(periodId);
    const nextAllotted = overrideDays ?? period.ruleDays;
    if (nextAllotted < usedDays) {
      businessRule(
        `No se puede asignar ${nextAllotted} día(s): el período ya tiene ${usedDays} día(s) solicitados o aprobados.`,
      );
    }

    const updated = await prisma.vacationPeriod.update({
      where: { id: periodId },
      data: { overrideDays },
    });

    revalidatePath("/admin/vacations");
    revalidatePath("/fsr/vacations");
    return { data: { id: updated.id, allottedDays: allottedDaysFor(updated) } };
  });
}
