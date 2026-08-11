"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { isAdmin } from "@/lib/authz/authz";
import { prisma } from "@/lib/database/prisma.singleton";
import { mxDayRange } from "@/lib/utils/datetime";
import {
  type VacationFormData,
  validateVacationDates,
} from "@/lib/validations/vacations";
import { rejected } from "./result";

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
 * - Validates no active PENDIENTE or APROBADA vacation overlaps the range.
 * - New vacations are created in PENDIENTE status.
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

  // Check for overlap with PENDIENTE or APROBADA vacations of the same user
  const blockingStatuses = await prisma.vacationStatus.findMany({
    where: { name: { in: ["PENDIENTE", "APROBADA"] }, active: true },
    select: { id: true },
  });

  const blockingStatusIds = blockingStatuses.map((s) => s.id);

  const overlap = await prisma.vacation.findFirst({
    where: {
      userId: targetUserId,
      active: true,
      statusId: { in: blockingStatusIds },
      // Inclusive overlap: existing.startDate <= newEnd AND existing.endDate >= newStart
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true, startDate: true, endDate: true },
  });

  if (overlap) {
    return rejected(
      "El período solicitado se superpone con una solicitud de vacaciones pendiente o aprobada existente.",
    );
  }

  const vacation = await prisma.vacation.create({
    data: {
      userId: targetUserId,
      startDate,
      endDate,
      reason: data.reason ?? null,
      statusId: pendienteStatus.id,
    },
  });

  revalidatePath("/admin/vacations");
  revalidatePath("/fsr/vacations");
  return { success: true, data: vacation };
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
    select: { active: true, status: { select: { name: true } } },
  });

  if (!existing || !existing.active) {
    throw new Error("Solicitud de vacaciones no encontrada.");
  }

  if (existing.status.name !== "PENDIENTE") {
    return rejected(
      `La solicitud ya fue resuelta (${existing.status.name}). Solo se puede decidir sobre solicitudes pendientes.`,
    );
  }

  const vacation = await prisma.vacation.update({
    where: { id },
    data: {
      statusId: status.id,
      approvedById: approverId,
      approvedAt: new Date(),
    },
  });

  revalidatePath("/admin/vacations");
  revalidatePath("/fsr/vacations");
  return { success: true, data: vacation };
}

/**
 * Approve a vacation (ADMIN only — requires vacations:approve).
 * Sets status to APROBADA and records approvedById and approvedAt.
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
