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

/**
 * Read an Excel date cell as the naive wall clock the sheet displays,
 * formatted as `YYYY-MM-DD HH:mm` for `parseMxDateTime`.
 *
 * A date cell in .xlsx is a serial number with no timezone — it means exactly
 * what the user sees. ExcelJS materializes that serial into a `Date` whose
 * **UTC** components carry the wall clock, so the value must be read with
 * `getUTC*`. Using local getters instead shifts every imported date by the
 * reader's offset, which in CDMX turns a date-only cell (midnight) into the
 * previous calendar day.
 */
export function excelDateToWallClock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}

/**
 * Build a `Date` that ExcelJS writes as the given wall clock — the inverse of
 * `excelDateToWallClock`. Use it for any date cell written into a template, so
 * the sheet shows the intended time regardless of the generator's timezone.
 *
 * `month` is 1-based, matching how the date reads on the sheet.
 */
export function excelDateCell(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hours, minutes));
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
 * Fill a `<input type="datetime-local">` from a stored instant.
 *
 * The input has no timezone: it shows exactly the characters you give it. The
 * obvious `toISOString().slice(0, 16)` hands it UTC, so a Mexico City user sees
 * a time six hours off and — because the same string is parsed back on save —
 * writes that shifted value into the database. Pair this with
 * `fromDatetimeLocalMX` and the round trip holds.
 */
export function toDatetimeLocalMX(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "";
  const { date, time } = mxDateAndTime(instant.toISOString());
  return `${date}T${time}`;
}

/** Read a `datetime-local` value back as Mexico City wall-clock time. */
export function fromDatetimeLocalMX(value: string): Date | null {
  if (!value) return null;
  const [date, time] = value.split("T");
  if (!date) return null;
  return localWallTimeToUTC(date, (time ?? "00:00").slice(0, 5));
}

/**
 * Hour of day (0-23) in Mexico City.
 *
 * `getHours()` reads the runtime's clock, so an agenda that buckets by hour
 * puts events in the wrong row for anyone outside CDMX — and in every row on a
 * UTC server.
 */
export function mxHour(date: Date | string): number {
  return Number(
    new Date(date).toLocaleString("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: APP_TZ,
    }),
  );
}

/** Fill an `<input type="date">` from a stored instant, in CDMX terms. */
export function toDateInputMX(value: Date | string | null | undefined): string {
  if (!value) return "";
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? "" : mxDateString(instant);
}

/** Read a `date` input back as the start of that Mexico City day. */
export function fromDateInputMX(value: string): Date | null {
  return value ? mxDayRange(value).gte : null;
}

/**
 * Mexican states that do NOT run on Mexico City time, by `State.code`.
 *
 * Anything absent from this map is Central, which is every state the system
 * currently has centers in — the map exists so that the day a center opens in
 * Sonora or Quintana Roo, the times on screen do not quietly become wrong.
 *
 * Keyed by code rather than name because the code is the stable identifier in
 * the State catalog (names carry accents and get edited).
 */
const STATE_TIMEZONES: Record<string, string> = {
  BCN: "America/Tijuana", // Baja California — Pacific
  BCS: "America/Mazatlan", // Baja California Sur — Mountain
  CHH: "America/Chihuahua", // Chihuahua — Central since 2022, border strip differs
  NAY: "America/Mazatlan", // Nayarit — Mountain
  ROO: "America/Cancun", // Quintana Roo — Eastern, no DST
  SIN: "America/Mazatlan", // Sinaloa — Mountain
  SON: "America/Hermosillo", // Sonora — Mountain, no DST
};

/** IANA zone for a state code; Mexico City for anything unmapped or unknown. */
export function timezoneForState(stateCode?: string | null): string {
  if (!stateCode) return APP_TZ;
  return STATE_TIMEZONES[stateCode.toUpperCase()] ?? APP_TZ;
}

/**
 * An incident's timestamp, written for people coordinating across states.
 *
 * Renders the time where the center actually is, and appends the Mexico City
 * time when the two differ — admins all work on CDMX time, so a report that
 * reads "14:30" in Cancún has to also say what that is on their clock, or a
 * phone call about "las 2:30" means two different moments.
 *
 * When the center is already on Mexico City time (every state in the system
 * today) the parenthetical is omitted, because repeating the same number twice
 * is noise.
 *
 * Pure `Intl` with an explicit `timeZone`, so it produces the same string on
 * the server and in the browser — which also rules out the hydration mismatch
 * a bare `toLocaleString()` risks in client components.
 */
export function formatIncidentDateTime(
  date: Date | string,
  stateCode?: string | null,
  opts: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  },
): string {
  const instant = new Date(date);
  const zone = timezoneForState(stateCode);
  const local = instant.toLocaleString("es-MX", { ...opts, timeZone: zone });

  if (zone === APP_TZ) return local;

  // Only the clock time is worth repeating; the date is implied by the first.
  const cdmxTime = instant.toLocaleString("es-MX", {
    timeStyle: "short",
    timeZone: APP_TZ,
  });
  return `${local} (${cdmxTime} CDMX)`;
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

/**
 * Convert a "YYYY-MM-DD" date string (interpreted as a wall-clock date in
 * Mexico City) into a Prisma-ready `{ gte, lte }` range spanning from
 * start-of-day to end-of-day in CDMX time (returned as UTC Date instants).
 *
 * Use this for all Prisma `where` clauses that filter by a single calendar
 * day or a date range entered by users in the reports UI.
 *
 * Example: mxDayRange("2026-06-10")
 *   gte → 2026-06-10T06:00:00.000Z  (CDMX midnight = UTC 06:00)
 *   lte → 2026-06-11T05:59:59.999Z  (CDMX 23:59:59.999 = UTC next-day 05:59)
 */
export function mxDayRange(dateStr: string): { gte: Date; lte: Date } {
  const gte = moment.tz(dateStr, "YYYY-MM-DD", APP_TZ).startOf("day").toDate();
  const lte = moment.tz(dateStr, "YYYY-MM-DD", APP_TZ).endOf("day").toDate();
  return { gte, lte };
}

/**
 * Today's date in Mexico City time, formatted as "YYYY-MM-DD".
 * Thin wrapper around `mxDateString` for use as a default date value in
 * server-rendered pages and report defaults.
 */
export function mxTodayString(): string {
  return mxDateString(new Date());
}

/**
 * The date N days ago in Mexico City time, formatted as "YYYY-MM-DD".
 * Useful for building default "last N days" ranges without UTC drift.
 */
export function mxDaysAgoString(n: number): string {
  return moment().tz(APP_TZ).subtract(n, "days").format("YYYY-MM-DD");
}
