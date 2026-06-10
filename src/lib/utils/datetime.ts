import moment from "moment-timezone";

/**
 * Project timezone. All wall-clock dates entered by users (incident scheduled
 * start, bulk import dates) are interpreted in this zone, and all date-range
 * queries are computed against it. This avoids the off-by-one / off-by-hours
 * shift that happens when `new Date("YYYY-MM-DDTHH:mm")` is parsed in the
 * runtime's timezone (UTC on the server) instead of Mexico City.
 */
export const APP_TZ = "America/Mexico_City";

/**
 * Convert a wall-clock date + time (as typed by the user, in Mexico City time)
 * into a UTC Date for storage. e.g. ("2026-06-09", "09:00") → the instant that
 * is 09:00 in CDMX, regardless of where the code runs.
 */
export function localWallTimeToUTC(dateStr: string, timeStr = "00:00"): Date {
  return moment
    .tz(`${dateStr} ${timeStr}`, "YYYY-MM-DD HH:mm", APP_TZ)
    .toDate();
}

/**
 * Parse a free-form wall-clock string (from Excel: "YYYY-MM-DD" or
 * "YYYY-MM-DD HH:mm") as Mexico City time → UTC Date. Returns null if invalid.
 */
export function parseMxDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const m = moment.tz(
    trimmed,
    ["YYYY-MM-DD HH:mm", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD", moment.ISO_8601],
    APP_TZ,
  );
  return m.isValid() ? m.toDate() : null;
}

/** Format a Date as `YYYY-MM-DD` in Mexico City time (for query ranges). */
export function mxDateString(date: Date): string {
  return moment(date).tz(APP_TZ).format("YYYY-MM-DD");
}

/** Split an ISO instant into `{ date, time }` wall-clock fields in CDMX time. */
export function mxDateAndTime(iso: string | null): {
  date: string;
  time: string;
} {
  if (!iso) return { date: "", time: "09:00" };
  const m = moment(iso).tz(APP_TZ);
  if (!m.isValid()) return { date: "", time: "09:00" };
  return { date: m.format("YYYY-MM-DD"), time: m.format("HH:mm") };
}

/** Localized display string in Mexico City time. */
export function formatMX(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
): string {
  return new Date(date).toLocaleString("es-MX", { ...opts, timeZone: APP_TZ });
}

/**
 * Current-week range (Monday 00:00 → Sunday 23:59:59) in Mexico City time.
 * Returned as Date objects (instants) suitable for the programación calendar.
 */
export function currentWeekRange(reference: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const ref = moment(reference).tz(APP_TZ);
  const start = ref.clone().startOf("isoWeek"); // Monday
  const end = ref.clone().endOf("isoWeek"); // Sunday
  return { start: start.toDate(), end: end.toDate() };
}
