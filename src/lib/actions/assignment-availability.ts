"use server";

import { z } from "zod";
import type {
  FsrAvailabilityData,
  FsrAvailabilityRequest,
} from "@/lib/assignments/fsr-availability";
import { loadAssignmentFor, loadIncidentFor } from "@/lib/auth/access";
import { requirePermission } from "@/lib/auth/auth";
import { ROLE } from "@/lib/authz/roles";
import { whereHasRole } from "@/lib/authz/user-queries";
import { VACATION_STATUS } from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";
import { isHoliday } from "@/lib/utils/availability";
import { mxDayRange } from "@/lib/utils/datetime";
import { type ActionResult, businessRule, guarded, rejected } from "./result";

const requestSchema = z.strictObject({
  incidentId: z.number().int().positive(),
  assignmentId: z.string().min(1).optional(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((day) => {
      const date = new Date(`${day}T12:00:00Z`);
      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === day
      );
    })
    .nullable(),
});

export async function getAssignmentFsrAvailability(
  request: FsrAvailabilityRequest,
): Promise<ActionResult<FsrAvailabilityData>> {
  const actor = await requirePermission("assignments:manage-all");
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) return rejected("Fecha o asignación no válida.");

  return guarded(() =>
    prisma.$transaction(async (tx) => {
      const { incidentId, assignmentId, scheduledDate } = parsed.data;
      await loadIncidentFor(actor, incidentId, tx);
      if (assignmentId) {
        const assignment = await loadAssignmentFor(
          actor,
          assignmentId,
          "manager",
          tx,
        );
        if (assignment.incidentId !== incidentId)
          businessRule("No encontrado.");
      }
      // Client membership is a suggestion, not an eligibility restriction.
      const candidates = await tx.user.findMany({
        where: { active: true, ...whereHasRole(ROLE.FSR) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const holiday =
        scheduledDate !== null && (await isHoliday(scheduledDate, tx));
      const absent = new Set<string>();
      if (scheduledDate !== null && !holiday && candidates.length > 0) {
        const { gte, lte } = mxDayRange(scheduledDate);
        const vacations = await tx.vacation.findMany({
          where: {
            active: true,
            userId: { in: candidates.map((fsr) => fsr.id) },
            status: { code: VACATION_STATUS.APROBADA },
            startDate: { lte },
            endDate: { gte },
          },
          select: { userId: true },
        });
        for (const vacation of vacations) absent.add(vacation.userId);
      }
      return {
        date: scheduledDate,
        fsrs: candidates.map((fsr) => ({
          userId: fsr.id,
          name: fsr.name,
          unavailable: holiday || absent.has(fsr.id),
          reason: holiday
            ? ("HOLIDAY" as const)
            : absent.has(fsr.id)
              ? ("APPROVED_ABSENCE" as const)
              : null,
        })),
      };
    }),
  );
}
