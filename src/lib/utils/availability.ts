import type { Holiday } from "@prisma/client";
import moment from "moment-timezone";
import { prisma } from "@/lib/database/prisma.singleton";
import { APP_TZ, mxDateString, mxDayRange } from "@/lib/utils/datetime";

/**
 * Determine whether a single active Holiday rule matches a given calendar date
 * (expressed as a "YYYY-MM-DD" string in Mexico City time).
 *
 * Rules:
 * - If isRecurring is false and the rule has a year, the calendar year of
 *   dateStr must match rule.year exactly (one-time sexennial event).
 * - month must match rule.month.
 * - Fixed date: day-of-month === rule.day.
 * - N-th Monday: day-of-week === Monday AND floor((dayOfMonth-1)/7)+1 === rule.nthMonday.
 */
export function holidayRuleMatchesDate(
  rule: Holiday,
  dateStr: string,
): boolean {
  const m = moment.tz(dateStr, "YYYY-MM-DD", APP_TZ);

  // One-time (sexennial) check: year must match when isRecurring is false.
  if (!rule.isRecurring && rule.year !== null && m.year() !== rule.year) {
    return false;
  }

  // Month must always match.
  if (m.month() + 1 !== rule.month) {
    return false;
  }

  // Fixed date rule (day set, nthMonday null).
  if (rule.day !== null) {
    return m.date() === rule.day;
  }

  // N-th Monday rule (nthMonday set, day null).
  if (rule.nthMonday !== null) {
    const isMonday = m.isoWeekday() === 1;
    const nthOccurrence = Math.floor((m.date() - 1) / 7) + 1;
    return isMonday && nthOccurrence === rule.nthMonday;
  }

  // Malformed rule (neither day nor nthMonday set) — treat as non-matching.
  return false;
}

/**
 * Returns true when the given calendar date (CDMX) is an active official holiday.
 *
 * Implementation: narrow DB query to rows with matching month, then evaluate
 * each rule in memory (~8 rows total). Avoids full-table scans.
 */
export async function isHoliday(dateStr: string): Promise<boolean> {
  const m = moment.tz(dateStr, "YYYY-MM-DD", APP_TZ);
  const month = m.month() + 1;

  const rules = await prisma.holiday.findMany({
    where: { active: true, month },
  });

  return rules.some((rule) => holidayRuleMatchesDate(rule, dateStr));
}

/**
 * Every active-holiday date in a calendar year, as a set of "YYYY-MM-DD"
 * strings in CDMX time.
 *
 * Fetches the ~8 holiday rules once and evaluates them in memory across the
 * year, rather than issuing a query per day: counting business days over a
 * two-week vacation request would otherwise mean 14 round trips.
 *
 * Used by the vacation-balance day counter; `isHoliday` remains the right call
 * for a one-off single-date check.
 */
export async function getHolidayDatesForYear(
  year: number,
): Promise<Set<string>> {
  const rules = await prisma.holiday.findMany({ where: { active: true } });

  const dates = new Set<string>();
  const cursor = moment.tz(`${year}-01-01`, "YYYY-MM-DD", APP_TZ);
  const endOfYear = moment.tz(`${year}-12-31`, "YYYY-MM-DD", APP_TZ);

  while (cursor.isSameOrBefore(endOfYear, "day")) {
    const dateStr = cursor.format("YYYY-MM-DD");
    if (rules.some((rule) => holidayRuleMatchesDate(rule, dateStr))) {
      dates.add(dateStr);
    }
    cursor.add(1, "day");
  }

  return dates;
}

/**
 * Returns true when a given FSR is unavailable on the CDMX calendar day
 * corresponding to `date` (a UTC instant).
 *
 * A user is considered unavailable when:
 * 1. The CDMX day is an active Holiday (any rule), OR
 * 2. The user has an APROBADA, active Vacation whose date range (inclusive)
 *    covers that CDMX day.
 *
 * Only APROBADA vacations block; PENDIENTE or RECHAZADA do not (RF-703).
 */
export async function isFsrUnavailable(
  userId: string,
  date: Date,
): Promise<boolean> {
  const dateStr = mxDateString(date);

  // Check holidays first (cheaper: narrow by month, ~8 rows).
  const holiday = await isHoliday(dateStr);
  if (holiday) return true;

  // Check approved vacation covering this CDMX day.
  const { gte, lte } = mxDayRange(dateStr);

  const vacation = await prisma.vacation.findFirst({
    where: {
      userId,
      active: true,
      status: { name: "APROBADA" },
      // Inclusive overlap: vacation's startDate <= CDMX end-of-day AND endDate >= CDMX start-of-day.
      startDate: { lte },
      endDate: { gte },
    },
    select: { id: true },
  });

  return vacation !== null;
}

/**
 * Batch variant: returns the subset of userIds that are unavailable on the
 * given date. Intended for future bulk scheduling checks; not wired in S1–S3.
 *
 * Uses parallel individual checks rather than a single complex query because
 * holiday evaluation requires in-memory rule matching and typical assignee
 * counts are small (1–5 FSRs per assignment).
 */
export async function unavailableFsrsForDate(
  userIds: string[],
  date: Date,
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const results = await Promise.all(
    userIds.map(async (id) => ({
      id,
      unavailable: await isFsrUnavailable(id, date),
    })),
  );

  return new Set(results.filter((r) => r.unavailable).map((r) => r.id));
}
