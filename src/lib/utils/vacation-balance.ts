import moment from "moment-timezone";
import { getHolidayDatesForYear } from "@/lib/utils/availability";
import { APP_TZ, mxDateString } from "@/lib/utils/datetime";

/**
 * How many days a vacation request costs against a period's balance.
 *
 * Only business days are charged: weekends and official holidays are free.
 * This is a DIFFERENT question from `isFsrUnavailable`, which asks whether a
 * single day is blocked for scheduling and therefore covers every day inside
 * an approved range, weekends included. Keep the two apart — conflating them
 * would either charge people for Sundays or let work be scheduled on them.
 *
 * Split pure/impure like `holidayRuleMatchesDate` vs `isHoliday`: the counting
 * rules are testable with a plain Set, no database in the way.
 */

/**
 * Count business days in an inclusive date range, given the holidays to skip.
 *
 * Pure: `holidayDates` holds "YYYY-MM-DD" strings in CDMX time (see
 * `getHolidayDatesForYear`). Returns 0 when the range is inverted.
 */
export function countBusinessDaysSync(
  startDate: Date,
  endDate: Date,
  holidayDates: ReadonlySet<string>,
): number {
  const start = moment.tz(mxDateString(startDate), "YYYY-MM-DD", APP_TZ);
  const end = moment.tz(mxDateString(endDate), "YYYY-MM-DD", APP_TZ);

  if (end.isBefore(start, "day")) return 0;

  let count = 0;
  const cursor = start.clone();

  while (cursor.isSameOrBefore(end, "day")) {
    const isWeekend = cursor.isoWeekday() >= 6; // 6 = Saturday, 7 = Sunday
    if (!isWeekend && !holidayDates.has(cursor.format("YYYY-MM-DD"))) {
      count += 1;
    }
    cursor.add(1, "day");
  }

  return count;
}

/**
 * Business days in an inclusive range, resolving holidays from the database.
 *
 * Loads the holiday set once per calendar year the range touches, so a request
 * spanning New Year still gets both years' rules.
 */
export async function countBusinessDays(
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const startYear = moment(startDate).tz(APP_TZ).year();
  const endYear = moment(endDate).tz(APP_TZ).year();

  const years: number[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }

  const perYear = await Promise.all(years.map(getHolidayDatesForYear));
  const holidayDates = new Set<string>(perYear.flatMap((set) => [...set]));

  return countBusinessDaysSync(startDate, endDate, holidayDates);
}
