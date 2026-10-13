"use server";

import type { Prisma, Vacation } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { userHasPermission } from "@/lib/authz/authz";
import { ROLE } from "@/lib/authz/roles";
import {
  codeOf,
  isVacationPending,
  VACATION_STATUS,
} from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";
import { serializableTransaction } from "@/lib/database/serializable-transaction";
import {
  notifyVacationApproved,
  notifyVacationCancelled,
  notifyVacationCorrected,
  notifyVacationRejected,
  notifyVacationRequested,
} from "@/lib/notifications";
import { vacationApprovers } from "@/lib/notifications/audiences";
import {
  allottedDaysFor,
  ensurePeriodsUpToNow,
  getPeriodBalance,
  resolveVacationPeriod,
} from "@/lib/services/vacation-periods";
import { vacationChargedDates } from "@/lib/services/vacation-periods-policy";
import { ASSIGNMENT_STATE } from "@/lib/state-machine/assignment-machine";
import { getHolidayDatesForYear } from "@/lib/utils/availability";
import { mxDateString, mxDayRange } from "@/lib/utils/datetime";
import {
  VacationCreateSchema,
  type VacationFormData,
  type VacationUpdateInput,
  VacationUpdateSchema,
  validateVacationDates,
} from "@/lib/validations/vacations";
import { businessRule, guarded, ok, rejected } from "./result";

/**
 * Whether the caller administers OTHER people's vacations.
 *
 * Not "is an admin": every employee holds `vacations:read` for their own
 * requests, and an operations admin has no business reading them. The
 * capability belongs to ADMIN_VACACIONES (and ROOT, implicitly).
 */
function managesAllVacations(caller: Parameters<typeof userHasPermission>[0]) {
  return userHasPermission(caller, "vacations:manage");
}

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
export async function getVacations(params?: {
  statusId?: number;
  page?: number;
  limit?: number;
}) {
  const caller = await requirePermission("vacations:read");

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    active: true,
    ...(params?.statusId !== undefined ? { statusId: params.statusId } : {}),
    ...(managesAllVacations(caller) ? {} : { userId: caller.id }),
  };

  // Fase 5e (H-19): pending-first ordering belongs in the query. Sorting in
  // memory after pagination buries page-2 pendings under history, so the
  // queue is two slices: pending requests first, then everything else, with
  // the page window taken across the union. (Once status codes exist —
  // Fase 3 — this can become a single orderBy; on this base there is no
  // stable code column yet, hence the two-query approach.)
  const include = {
    user: { select: { id: true, name: true, email: true } },
    status: true,
    approvedBy: { select: { id: true, name: true } },
  } satisfies Prisma.VacationInclude;
  type VacationRow = Prisma.VacationGetPayload<{
    include: typeof include;
  }>;
  const orderBy = [{ startDate: "desc" as const }];

  const pendienteStatus = await prisma.vacationStatus.findFirst({
    // Stable code (Fase 3 · H-08), not the display name.
    where: { code: VACATION_STATUS.PENDIENTE, active: true },
    select: { id: true },
  });

  const pendingWhere = pendienteStatus
    ? { ...where, statusId: pendienteStatus.id }
    : { ...where, statusId: -1 };
  const restWhere = pendienteStatus
    ? { ...where, statusId: { not: pendienteStatus.id } }
    : where;

  const [pendingTotal, total] = await Promise.all([
    prisma.vacation.count({ where: pendingWhere }),
    prisma.vacation.count({ where }),
  ]);

  let rows: VacationRow[];
  if (skip < pendingTotal) {
    const pendingRows = await prisma.vacation.findMany({
      where: pendingWhere,
      include,
      orderBy,
      skip,
      take: limit,
    });
    const restRows =
      pendingRows.length < limit
        ? await prisma.vacation.findMany({
            where: restWhere,
            include,
            orderBy,
            skip: 0,
            take: limit - pendingRows.length,
          })
        : [];
    rows = [...pendingRows, ...restRows];
  } else {
    rows = await prisma.vacation.findMany({
      where: restWhere,
      include,
      orderBy,
      skip: skip - pendingTotal,
      take: limit,
    });
  }

  return {
    data: rows,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
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
      ...(managesAllVacations(caller) ? {} : { userId: caller.id }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      status: true,
      approvedBy: { select: { id: true, name: true } },
    },
  });

  if (!vacation) return null;
  return {
    ...vacation,
    chargeSnapshotAvailable: vacation.chargedDates.length > 0,
  };
}

/**
 * Everyone who can hold vacation days.
 *
 * Was restricted to FSRs, which left every administrative employee unable to
 * have a request registered for them. Vacations belong to PEOPLE, so the rule
 * is by exclusion rather than by listing roles:
 *
 *   - REPORTER is the shared account of a verification centre, not a person.
 *   - ROOT is the system superuser, an account rather than an employee.
 *
 * Anyone else — FSR, EMPLEADO, the module administrators — accrues days.
 */
export async function getEmployeesForVacations() {
  await requirePermission("vacations:create");

  return prisma.user.findMany({
    where: {
      active: true,
      NOT: {
        userRoles: {
          some: {
            active: true,
            role: { code: { in: [ROLE.REPORTER, ROLE.ROOT] } },
          },
        },
      },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
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

  VacationCreateSchema.parse(data);

  // Normalize the picked calendar dates to CDMX day bounds so single-day and
  // multi-day vacations cover the full Mexico City day. The HTML date input
  // yields a UTC-midnight Date whose ISO date is the day the user picked.
  const startDate = mxDayRange(data.startDate.toISOString().slice(0, 10)).gte;
  const endDate = mxDayRange(data.endDate.toISOString().slice(0, 10)).lte;

  // Resolve target user
  const targetUserId = data.userId ?? caller.id;

  if (targetUserId !== caller.id && !managesAllVacations(caller)) {
    return rejected(
      "No tiene permisos para crear vacaciones en nombre de otro usuario.",
    );
  }

  const result = await guarded(async () => {
    validateVacationDates(data);
    if (startDate < mxDayRange(mxDateString(new Date())).gte) {
      if (!managesAllVacations(caller))
        businessRule("No puede solicitar vacaciones con fechas retroactivas.");
      if (!data.reason?.trim())
        businessRule(
          "Debe indicar un motivo para registrar vacaciones retroactivas.",
        );
    }
    const vacation = await serializableTransaction(async (tx) => {
      const employee = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { active: true },
      });
      if (!employee?.active)
        businessRule("El usuario seleccionado no está activo.");

      // Resolve PENDIENTE status id — by stable code (H-08).
      const pendienteStatus = await tx.vacationStatus.findFirst({
        where: { code: VACATION_STATUS.PENDIENTE, active: true },
        select: { id: true },
      });

      if (!pendienteStatus) {
        throw new Error(
          "Estado 'PENDIENTE' no encontrado. Verifique la configuración del sistema.",
        );
      }

      const chargedDates = await vacationChargedDates(startDate, endDate, tx);
      const businessDaysUsed = chargedDates.length;

      if (businessDaysUsed === 0) {
        businessRule(
          "El rango solicitado no incluye días de vacaciones computables (solo domingos o días festivos).",
        );
      }

      const period = await resolveVacationPeriod(
        targetUserId,
        startDate,
        endDate,
        tx,
        data.periodId,
        businessDaysUsed,
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
          status: {
            code: { in: [VACATION_STATUS.PENDIENTE, VACATION_STATUS.APROBADA] },
          },
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
          chargedDates,
          statusId: pendienteStatus.id,
          periodId: period.id,
          businessDaysUsed,
          createdById: caller.id,
          updatedById: caller.id,
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
    revalidatePath("/vacations");
  }

  return result;
}

/** Replace a pending reservation and its evidence atomically. */
export async function updateVacation(id: string, input: VacationUpdateInput) {
  const caller = await requirePermission("vacations:update");
  const parsed = VacationUpdateSchema.safeParse(input);
  if (!parsed.success)
    return rejected(
      parsed.error.issues.some((issue) => issue.code === "unrecognized_keys")
        ? "Solo puede editar fechas, motivo y período de la solicitud."
        : (parsed.error.issues[0]?.message ??
            "Los datos de la solicitud no son válidos."),
    );
  const data = parsed.data;
  const today = mxDayRange(mxDateString(new Date())).gte;
  const startDate = mxDayRange(data.startDate.toISOString().slice(0, 10)).gte;
  const endDate = mxDayRange(data.endDate.toISOString().slice(0, 10)).lte;
  const snapshot = (row: Vacation) => ({
    operation: "PENDING_EDIT",
    userId: row.userId,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    reason: row.reason,
    periodId: row.periodId,
    chargedDates: row.chargedDates,
    businessDaysUsed: row.businessDaysUsed,
    statusId: row.statusId,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    correctionHistory: row.correctionHistory,
  });
  const result = await guarded(async () =>
    serializableTransaction(async (tx) => {
      const existing = await tx.vacation.findUnique({
        where: { id, active: true },
        include: { status: true },
      });
      if (!existing)
        businessRule("Solicitud de vacaciones no encontrada o cancelada.");
      if (existing.userId !== caller.id && !managesAllVacations(caller))
        businessRule(
          "Solo puede editar sus propias solicitudes de vacaciones.",
        );
      if (!isVacationPending(existing.status))
        businessRule(
          "Solo puede editar solicitudes pendientes. La solicitud ya fue resuelta.",
        );
      const reason = data.reason === undefined ? existing.reason : data.reason;
      const replacement =
        mxDateString(startDate) !== mxDateString(existing.startDate) ||
        mxDateString(endDate) !== mxDateString(existing.endDate) ||
        (data.periodId !== undefined && data.periodId !== existing.periodId);
      const changes: Prisma.VacationUpdateManyMutationInput = {
        reason,
        updatedById: caller.id,
      };
      if (replacement) {
        if (startDate < today) {
          if (!managesAllVacations(caller))
            businessRule(
              "No puede solicitar vacaciones con fechas retroactivas.",
            );
          if (!reason?.trim())
            businessRule(
              "Debe indicar un motivo para registrar vacaciones retroactivas.",
            );
        }
        const employee = await tx.user.findUnique({
          where: { id: existing.userId },
          select: { active: true },
        });
        if (!employee?.active)
          businessRule("El usuario seleccionado no está activo.");
        const chargedDates = await vacationChargedDates(startDate, endDate, tx);
        if (!chargedDates.length)
          businessRule(
            "El rango solicitado no incluye días de vacaciones computables (solo domingos o días festivos).",
          );
        const overlap = await tx.vacation.findFirst({
          where: {
            id: { not: id },
            userId: existing.userId,
            active: true,
            status: {
              code: {
                in: [VACATION_STATUS.PENDIENTE, VACATION_STATUS.APROBADA],
              },
            },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { id: true },
        });
        if (overlap)
          businessRule(
            "El período solicitado se superpone con una solicitud de vacaciones pendiente o aprobada existente.",
          );
        const options = { excludeVacationId: id };
        const period = await resolveVacationPeriod(
          existing.userId,
          startDate,
          endDate,
          tx,
          data.periodId,
          chargedDates.length,
          options,
        );
        const balance = await getPeriodBalance(period.id, tx, options);
        if (chargedDates.length > balance.remainingDays)
          businessRule(
            "El período seleccionado no tiene saldo suficiente para el rango completo.",
          );
        Object.assign(changes, {
          startDate,
          endDate,
          chargedDates,
          businessDaysUsed: chargedDates.length,
          periodId: period.id,
        });
      } else if (
        startDate < today &&
        managesAllVacations(caller) &&
        !reason?.trim()
      ) {
        businessRule(
          "Debe indicar un motivo para registrar vacaciones retroactivas.",
        );
      }
      const changed = await tx.vacation.updateMany({
        where: {
          id,
          active: true,
          status: { code: VACATION_STATUS.PENDIENTE },
          updatedAt: existing.updatedAt,
        },
        data: changes,
      });
      if (changed.count !== 1)
        businessRule(
          "La solicitud cambió o fue resuelta por otro usuario. Actualiza y vuelve a intentar.",
        );
      const updated = await tx.vacation.findUniqueOrThrow({ where: { id } });
      await tx.businessCorrection.create({
        data: {
          entityType: "Vacation",
          entityId: id,
          actorId: caller.id,
          reason: "Pending vacation request edited",
          before: snapshot(existing),
          after: snapshot(updated),
        },
      });
      return { data: updated };
    }),
  );
  if (result.success) {
    revalidatePath("/vacations");
    revalidatePath("/admin/vacations");
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
  const result = await guarded(async () =>
    serializableTransaction(async (tx) => {
      const status = await tx.vacationStatus.findFirst({
        where: { code: target, active: true },
        select: { id: true },
      });

      if (!status) {
        throw new Error(`Estado '${target}' no encontrado.`);
      }

      const existing = await tx.vacation.findUnique({
        where: { id },
        select: {
          active: true,
          userId: true,
          status: { select: { code: true, name: true } },
        },
      });

      if (!existing || !existing.active) {
        businessRule("Solicitud de vacaciones no encontrada o cancelada.");
      }

      if (!isVacationPending(existing.status)) {
        businessRule(
          `La solicitud ya fue resuelta (${codeOf(existing.status)}). Solo se puede decidir sobre solicitudes pendientes.`,
        );
      }

      // No balance re-check is needed here. A PENDIENTE request already reserves
      // its days (getPeriodBalance counts PENDIENTE and APROBADA alike), so
      // approving consumes nothing new and rejecting frees them by dropping the
      // request out of that sum.
      const changed = await tx.vacation.updateMany({
        where: {
          id,
          active: true,
          status: { code: VACATION_STATUS.PENDIENTE },
        },
        data: {
          statusId: status.id,
          approvedById: approverId,
          approvedAt: new Date(),
          updatedById: approverId,
        },
      });
      if (changed.count !== 1)
        businessRule(
          "La solicitud ya fue resuelta o cancelada por otro usuario.",
        );
      const vacation = await tx.vacation.findUniqueOrThrow({ where: { id } });
      return { data: vacation };
    }),
  );
  if (!result.success) return result;

  if (target === "APROBADA") {
    await notifyVacationApproved(
      result.data.id,
      result.data.userId,
      approverId,
    );
  } else {
    await notifyVacationRejected(
      result.data.id,
      result.data.userId,
      approverId,
    );
  }

  revalidatePath("/admin/vacations");
  revalidatePath("/vacations");
  return result;
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
      status: { code: { not: ASSIGNMENT_STATE.CERRADO } },
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
 *
 * The cancellation notifies whoever still needs to know: the requester
 * cancelling their own request alerts the approvers (with their name, so the
 * queue owner knows whose row vanished); an admin cancelling someone else's
 * alerts the requester. Fires post-commit, never throws.
 */
export async function deleteVacation(id: string) {
  const caller = await requirePermission("vacations:delete");
  const result = await guarded(async () =>
    serializableTransaction(async (tx) => {
      const vacation = await tx.vacation.findUnique({
        where: { id, active: true },
        include: { status: true, user: { select: { name: true } } },
      });

      if (!vacation) {
        businessRule("Solicitud de vacaciones no encontrada o cancelada.");
      }

      if (!managesAllVacations(caller) && vacation.userId !== caller.id) {
        businessRule(
          "Solo puede eliminar sus propias solicitudes de vacaciones.",
        );
      }
      if (
        codeOf(vacation.status) === VACATION_STATUS.APROBADA &&
        vacation.startDate <= mxDayRange(mxDateString(new Date())).lte
      ) {
        businessRule(
          "No puede cancelar una vacación aprobada que ya comenzó. Un administrador debe registrar una corrección con motivo para conservar los días consumidos.",
        );
      }
      const changed = await tx.vacation.updateMany({
        where: { id, active: true, statusId: vacation.statusId },
        data: {
          active: false,
          updatedById: caller.id,
          deactivatedById: caller.id,
          deactivatedAt: new Date(),
        },
      });
      if (changed.count !== 1)
        businessRule("La solicitud cambió o fue cancelada por otro usuario.");
      return { data: vacation };
    }),
  );
  if (!result.success) return result;
  const vacation = result.data;

  const selfCancel = vacation.userId === caller.id;
  const recipients = selfCancel ? await vacationApprovers() : [vacation.userId];
  await notifyVacationCancelled(
    id,
    selfCancel ? vacation.user.name : null,
    recipients,
    caller.id,
  );

  revalidatePath("/admin/vacations");
  revalidatePath("/vacations");
  return ok();
}

/** Shorten an approved absence, retaining today and all past consumed days. */
export async function correctStartedVacation(
  id: string,
  endDate: Date,
  reason: string,
  reviewedConsumedDays?: number,
) {
  const caller = await requirePermission("vacations:manage");
  const result = await guarded(async () =>
    serializableTransaction(async (tx) => {
      if (!reason.trim() || reason.length > 1000)
        businessRule(
          "La corrección requiere un motivo de hasta 1000 caracteres.",
        );
      if (!Number.isFinite(endDate.getTime()))
        businessRule("La fecha de fin no es válida.");
      const endKey = endDate.toISOString().slice(0, 10);
      const nextEnd = mxDayRange(endKey).lte;
      const today = mxDateString(new Date());
      const vacation = await tx.vacation.findUnique({
        where: { id, active: true },
        include: { status: true },
      });
      if (
        !vacation?.active ||
        codeOf(vacation.status) !== VACATION_STATUS.APROBADA
      )
        businessRule("Solo puede corregir vacaciones aprobadas activas.");
      if (
        mxDateString(vacation.startDate) > today ||
        endKey < today ||
        nextEnd < vacation.startDate ||
        nextEnd >= vacation.endDate
      ) {
        businessRule(
          "La corrección debe acortar una vacación iniciada y conservar hoy y todos los días anteriores.",
        );
      }
      if (vacation.businessDaysUsed == null)
        businessRule(
          "La solicitud no tiene consumo conciliado. Concilia el historial antes de corregirla.",
        );
      let retainedDays: number;
      if (vacation.chargedDates.length > 0) {
        const unique = new Set(vacation.chargedDates);
        if (
          unique.size !== vacation.chargedDates.length ||
          vacation.chargedDates.some(
            (date) =>
              !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
              date < mxDateString(vacation.startDate),
          ) ||
          vacation.chargedDates.filter(
            (date) => date <= mxDateString(vacation.endDate),
          ).length !== vacation.businessDaysUsed
        )
          throw new Error("Vacation charge snapshot differs from consumption");
        retainedDays = vacation.chargedDates.filter(
          (date) => date <= endKey,
        ).length;
      } else {
        // No per-day snapshot exists on legacy requests. An explicit reviewed
        // count is necessary; today's holiday catalog cannot reconstruct history.
        if (
          reviewedConsumedDays == null ||
          !Number.isInteger(reviewedConsumedDays) ||
          reviewedConsumedDays < 0 ||
          reviewedConsumedDays > vacation.businessDaysUsed
        ) {
          businessRule(
            "La solicitud histórica requiere indicar los días consumidos revisados entre cero y el consumo original.",
          );
        }
        retainedDays = reviewedConsumedDays;
      }
      const changed = await tx.vacation.updateMany({
        where: {
          id,
          active: true,
          statusId: vacation.statusId,
          endDate: vacation.endDate,
          businessDaysUsed: vacation.businessDaysUsed,
        },
        data: {
          endDate: nextEnd,
          businessDaysUsed: retainedDays,
          updatedById: caller.id,
        },
      });
      if (changed.count !== 1)
        businessRule(
          "La solicitud cambió por otro usuario. Actualiza y vuelve a intentar.",
        );
      // The original charged dates, request reason, approval and prior audit are
      // immutable. Each correction gets its own append-only receipt.
      await tx.businessCorrection.create({
        data: {
          entityType: "Vacation",
          entityId: id,
          actorId: caller.id,
          reason: reason.trim(),
          before: {
            startDate: vacation.startDate.toISOString(),
            endDate: vacation.endDate.toISOString(),
            businessDaysUsed: vacation.businessDaysUsed,
            chargedDates: vacation.chargedDates,
            periodId: vacation.periodId,
            reason: vacation.reason,
            statusId: vacation.statusId,
            approvedById: vacation.approvedById,
            approvedAt: vacation.approvedAt?.toISOString() ?? null,
            correctionHistory: vacation.correctionHistory,
          },
          after: {
            startDate: vacation.startDate.toISOString(),
            endDate: nextEnd.toISOString(),
            businessDaysUsed: retainedDays,
            chargedDates: vacation.chargedDates,
            periodId: vacation.periodId,
            reason: vacation.reason,
            statusId: vacation.statusId,
            approvedById: vacation.approvedById,
            approvedAt: vacation.approvedAt?.toISOString() ?? null,
            correctionHistory: vacation.correctionHistory,
            reviewedConsumedDays:
              vacation.chargedDates.length === 0 ? retainedDays : null,
          },
        },
      });
      return {
        data: {
          id,
          retainedDays,
          releasedDays: vacation.businessDaysUsed - retainedDays,
          userId: vacation.userId,
        },
      };
    }),
  );
  if (result.success) {
    await notifyVacationCorrected(id, result.data.userId, caller.id);
    revalidatePath("/admin/vacations");
    revalidatePath("/vacations");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export interface VacationPeriodSummary {
  id: string;
  periodNumber: number;
  cycleYear: number | null;
  accrualStart: Date;
  accrualEnd: Date;
  graceEnd: Date;
  availableFrom: Date | null;
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
  if (targetUserId !== caller.id && !managesAllVacations(caller)) {
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

  const targetYear = year ?? Number(mxDateString(new Date()).slice(0, 4));

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
        cycleYear: period.cycleYear,
        accrualStart: period.accrualStart,
        accrualEnd: period.accrualEnd,
        graceEnd: period.graceEnd,
        availableFrom: period.availableFrom,
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
    include: { status: { select: { code: true, name: true, color: true } } },
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

  const result = await guarded(async () =>
    serializableTransaction(async (tx) => {
      if (overrideDays !== null) {
        if (!Number.isInteger(overrideDays) || overrideDays < 0) {
          businessRule(
            "Los días asignados deben ser un número entero positivo.",
          );
        }
        if (overrideDays > 365) {
          businessRule("Los días asignados no pueden exceder 365.");
        }
      }

      const period = await tx.vacationPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period) {
        throw new Error("Período vacacional no encontrado.");
      }

      // Lowering the allotment below what is already booked would leave the
      // period overdrawn. Refuse rather than silently showing a negative balance.
      // `usedDays` counts dated requests plus APPROVED historical aggregate
      // consumption linked to this period, so the floor covers both ledgers.
      const { usedDays } = await getPeriodBalance(periodId, tx);
      const nextAllotted = overrideDays ?? period.ruleDays;
      if (nextAllotted < usedDays) {
        businessRule(
          `No se puede asignar ${nextAllotted} día(s): el período ya tiene ${usedDays} día(s) consumidos o reservados.`,
        );
      }

      const updated = await tx.vacationPeriod.update({
        where: { id: periodId },
        data: { overrideDays },
      });

      return {
        data: { id: updated.id, allottedDays: allottedDaysFor(updated) },
      };
    }),
  );
  if (result.success) {
    revalidatePath("/admin/vacations");
    revalidatePath("/vacations");
  }
  return result;
}
