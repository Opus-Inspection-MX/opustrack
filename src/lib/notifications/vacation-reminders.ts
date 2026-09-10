import moment from "moment-timezone";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";
import { APP_TZ } from "@/lib/utils/datetime";
import { dispatch } from "./dispatch";
import { ENTITY_TYPES, NOTIFICATION_TYPES } from "./notification-types";

/**
 * `vacation_starting_soon` reminders (Phase 5 cron task).
 *
 * Every run looks for APROBADA vacations whose `startDate` falls on tomorrow's
 * calendar day in Mexico City time and reminds the requester. The audience is
 * fixed in code (the requester only) — the channel matrix still decides
 * whether it goes in-app, by mail, both or nowhere.
 *
 * Idempotency: a vacation that already has a `vacation_starting_soon`
 * notification pointing at it (same type + vacation entity) is skipped, so
 * overlapping cron runs never double-notify. Never throws: a reminder problem
 * must not fail the cron run or block the other tasks.
 */

export interface VacationReminderSummary {
  checked: number;
  sent: number;
  skipped: number;
}

/** UTC bounds of tomorrow's calendar day in Mexico City time. */
export function tomorrowCdmxRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = moment(now).tz(APP_TZ).add(1, "day").startOf("day").toDate();
  const end = moment(start).add(1, "day").toDate();
  return { start, end };
}

export async function sendVacationStartingSoonReminders(
  now: Date = new Date(),
): Promise<VacationReminderSummary> {
  const summary: VacationReminderSummary = { checked: 0, sent: 0, skipped: 0 };
  try {
    const { start, end } = tomorrowCdmxRange(now);
    const due = await prisma.vacation.findMany({
      where: {
        active: true,
        startDate: { gte: start, lt: end },
        status: { name: "APROBADA", active: true },
      },
      select: { id: true, userId: true },
    });
    if (due.length === 0) return summary;

    const existing = await prisma.notification.findMany({
      where: {
        active: true,
        type: NOTIFICATION_TYPES.VACATION_STARTING_SOON,
        entityType: ENTITY_TYPES.VACATION,
        entityId: { in: due.map((v) => v.id) },
      },
      select: { entityId: true },
    });
    const reminded = new Set(existing.map((n) => n.entityId));

    for (const vacation of due) {
      summary.checked += 1;
      if (reminded.has(vacation.id)) {
        summary.skipped += 1;
        continue;
      }
      try {
        await dispatch(NOTIFICATION_TYPES.VACATION_STARTING_SOON, {
          recipients: [vacation.userId],
          actorId: null,
          ctx: { vacationId: vacation.id },
          entity: { type: ENTITY_TYPES.VACATION, id: vacation.id },
        });
        summary.sent += 1;
      } catch (error) {
        // One poisoned vacation must not silence the rest of the batch.
        logger.error(
          "[vacation-reminders] Error reminding vacation:",
          error,
        );
        summary.skipped += 1;
      }
    }
  } catch (error) {
    logger.error(
      "[vacation-reminders] Error listing vacations starting soon:",
      error,
    );
  }
  return summary;
}
