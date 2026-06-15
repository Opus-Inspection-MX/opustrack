"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { isAdmin } from "@/lib/authz/authz";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  type VacationFormData,
  validateVacationDates,
} from "@/lib/validations/vacations";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get all active vacations (admin view, optionally filtered by statusId).
 */
export async function getVacations(statusId?: number) {
  await requirePermission("vacations:read");

  const vacations = await prisma.vacation.findMany({
    where: {
      active: true,
      ...(statusId !== undefined ? { statusId } : {}),
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
 */
export async function getVacationById(id: string) {
  await requirePermission("vacations:read");

  const vacation = await prisma.vacation.findUnique({
    where: { id },
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

  // Resolve target user
  const targetUserId = data.userId ?? caller.id;

  if (targetUserId !== caller.id && !isAdmin(caller)) {
    throw new Error(
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
      startDate: { lte: data.endDate },
      endDate: { gte: data.startDate },
    },
    select: { id: true, startDate: true, endDate: true },
  });

  if (overlap) {
    throw new Error(
      "El período solicitado se superpone con una solicitud de vacaciones pendiente o aprobada existente.",
    );
  }

  const vacation = await prisma.vacation.create({
    data: {
      userId: targetUserId,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason ?? null,
      statusId: pendienteStatus.id,
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

  const aprobadaStatus = await prisma.vacationStatus.findFirst({
    where: { name: "APROBADA", active: true },
    select: { id: true },
  });

  if (!aprobadaStatus) {
    throw new Error("Estado 'APROBADA' no encontrado.");
  }

  const vacation = await prisma.vacation.update({
    where: { id },
    data: {
      statusId: aprobadaStatus.id,
      approvedById: approver.id,
      approvedAt: new Date(),
    },
  });

  revalidatePath("/admin/vacations");
  return { success: true, data: vacation };
}

/**
 * Reject a vacation (ADMIN only — requires vacations:approve).
 * Sets status to RECHAZADA and records approvedById and approvedAt.
 */
export async function rejectVacation(id: string) {
  const approver = await requirePermission("vacations:approve");

  const rechazadaStatus = await prisma.vacationStatus.findFirst({
    where: { name: "RECHAZADA", active: true },
    select: { id: true },
  });

  if (!rechazadaStatus) {
    throw new Error("Estado 'RECHAZADA' no encontrado.");
  }

  const vacation = await prisma.vacation.update({
    where: { id },
    data: {
      statusId: rechazadaStatus.id,
      approvedById: approver.id,
      approvedAt: new Date(),
    },
  });

  revalidatePath("/admin/vacations");
  return { success: true, data: vacation };
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
      throw new Error(
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
  redirect("/fsr/vacations");
}
