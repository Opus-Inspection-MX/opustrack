import { type NextRequest, NextResponse } from "next/server";
import { retryDueEmails } from "@/lib/mail/outbox";
import { dispatchDueBroadcasts } from "@/lib/notifications/broadcast-dispatch";
import { sendVacationStartingSoonReminders } from "@/lib/notifications/vacation-reminders";
import { logger } from "@/lib/observability/logger";

/**
 * Cron entry point (Phase 5): `GET /api/cron/notifications`.
 *
 * Vercel Cron calls this with `Authorization: Bearer ${CRON_SECRET}` every 5
 * minutes (`vercel.json`). Each run performs three tasks with per-task error
 * isolation and idempotency, then returns a JSON count summary:
 *
 * 1. Due broadcasts via `dispatchDueBroadcasts` (atomic claim ⇒ exactly once).
 * 2. Due mail retries via `retryDueEmails` (backoff + max attempts).
 * 3. `vacation_starting_soon` reminders (skipped when already reminded).
 *
 * Auth is a shared secret, not a session — `src/middleware.ts` exempts
 * `/api/cron/*` from the login requirement for this reason. A missing,
 * malformed or wrong secret (or an unset `CRON_SECRET`) all answer the same
 * generic 401, so failures leak nothing about which half was wrong.
 *
 * Scheduling note: `vercel.json` keeps a DAILY cron (`0 13 * * *`, 07:00 in
 * CDMX) because Vercel Hobby rejects the whole deployment when the expression
 * would run more than once a day. The real 5-minute cadence lives in
 * `.github/workflows/cron-notifications.yml`, which curls this endpoint with
 * `CRON_SECRET` — the endpoint does not care who the HTTP client is as long as
 * the bearer matches.
 */

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each task absorbs its own errors (and the callees below never throw by
  // contract), so one failing task cannot starve the other two of their run.
  let broadcasts = { claimed: 0, delivered: 0 };
  try {
    const results = await dispatchDueBroadcasts();
    broadcasts = {
      claimed: results.filter((r) => r.claimed).length,
      delivered: results.reduce((total, r) => total + r.delivered, 0),
    };
  } catch (error) {
    logger.error("[cron] Error dispatching due broadcasts:", error);
  }

  let emails = { attempted: 0, sent: 0, failed: 0 };
  try {
    emails = await retryDueEmails();
  } catch (error) {
    logger.error("[cron] Error retrying due emails:", error);
  }

  let vacationReminders = { checked: 0, sent: 0, skipped: 0 };
  try {
    vacationReminders = await sendVacationStartingSoonReminders();
  } catch (error) {
    logger.error("[cron] Error sending vacation reminders:", error);
  }

  return NextResponse.json({ broadcasts, emails, vacationReminders });
}
