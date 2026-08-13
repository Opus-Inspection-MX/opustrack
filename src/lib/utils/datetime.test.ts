import { describe, expect, it } from "vitest";
import {
  APP_TZ,
  currentWeekRange,
  excelDateCell,
  excelDateToWallClock,
  formatIncidentDateTime,
  formatMX,
  fromDateInputMX,
  fromDatetimeLocalMX,
  localWallTimeToUTC,
  mxDateAndTime,
  mxDateString,
  mxDayRange,
  mxDaysAgoString,
  mxHour,
  mxTodayString,
  parseMxDateTime,
  timezoneForState,
  toDateInputMX,
  toDatetimeLocalMX,
} from "./datetime";

// All assertions below are DST-agnostic: they test calendar-day behavior and
// round-trips through Mexico City time, never a hard-coded UTC offset.

describe("mxDateString", () => {
  it("shifts an early-UTC instant back to the previous CDMX calendar day", () => {
    // 02:00 UTC is still the previous evening in CDMX (UTC-5 or UTC-6).
    expect(mxDateString(new Date("2026-06-09T02:00:00.000Z"))).toBe(
      "2026-06-08",
    );
  });

  it("keeps a midday-UTC instant on the same CDMX day", () => {
    expect(mxDateString(new Date("2026-06-09T12:00:00.000Z"))).toBe(
      "2026-06-09",
    );
  });
});

describe("localWallTimeToUTC + round-trip", () => {
  it("round-trips a wall-clock date back to the same CDMX day and time", () => {
    const utc = localWallTimeToUTC("2026-06-09", "09:00");
    expect(utc).toBeInstanceOf(Date);
    expect(mxDateString(utc)).toBe("2026-06-09");
    expect(mxDateAndTime(utc.toISOString())).toEqual({
      date: "2026-06-09",
      time: "09:00",
    });
  });
});

describe("mxDayRange", () => {
  it("spans the full CDMX calendar day for the given date string", () => {
    const { gte, lte } = mxDayRange("2026-06-10");
    expect(mxDateString(gte)).toBe("2026-06-10");
    expect(mxDateString(lte)).toBe("2026-06-10");
    expect(gte.getTime()).toBeLessThan(lte.getTime());
    // Just under 24h between start-of-day and end-of-day.
    expect(lte.getTime() - gte.getTime()).toBe(86_399_999);
  });
});

describe("parseMxDateTime", () => {
  it("parses a valid date-only string", () => {
    expect(parseMxDateTime("2026-06-09")).toBeInstanceOf(Date);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseMxDateTime("")).toBeNull();
    expect(parseMxDateTime("   ")).toBeNull();
    expect(parseMxDateTime("not-a-date")).toBeNull();
  });
});

describe("mxDateAndTime", () => {
  it("returns a default for null input", () => {
    expect(mxDateAndTime(null)).toEqual({ date: "", time: "09:00" });
  });
});

describe("excelDateToWallClock", () => {
  // ExcelJS materializes a date cell's serial number into a Date whose UTC
  // components carry the naive wall clock the sheet displays. Reading it with
  // local getters would shift it by the reader's offset — that is the bug this
  // helper exists to prevent, so every assertion here reads UTC-built Dates.
  it("returns the wall clock the sheet displays", () => {
    expect(excelDateToWallClock(new Date(Date.UTC(2026, 0, 15, 9, 0)))).toBe(
      "2026-01-15 09:00",
    );
  });

  it("keeps a midnight cell on its own calendar day", () => {
    // The regression that mattered most: a date-only cell must not roll back
    // to the previous day for readers west of UTC.
    expect(excelDateToWallClock(new Date(Date.UTC(2026, 0, 15, 0, 0)))).toBe(
      "2026-01-15 00:00",
    );
  });

  it("does not depend on the runtime timezone", () => {
    // Same instant, same output — the helper never consults local getters.
    const cell = new Date(Date.UTC(2026, 6, 4, 23, 30));
    expect(excelDateToWallClock(cell)).toBe("2026-07-04 23:30");
  });

  it("pads single-digit months, days, hours and minutes", () => {
    expect(excelDateToWallClock(new Date(Date.UTC(2026, 2, 5, 7, 5)))).toBe(
      "2026-03-05 07:05",
    );
  });
});

describe("excelDateCell", () => {
  it("builds a cell that Excel displays as the given wall clock", () => {
    expect(excelDateCell(2026, 1, 15, 9, 0).toISOString()).toBe(
      "2026-01-15T09:00:00.000Z",
    );
  });

  it("round-trips through excelDateToWallClock", () => {
    expect(excelDateToWallClock(excelDateCell(2026, 1, 15, 9, 0))).toBe(
      "2026-01-15 09:00",
    );
  });

  it("defaults the time to midnight", () => {
    expect(excelDateToWallClock(excelDateCell(2026, 12, 31))).toBe(
      "2026-12-31 00:00",
    );
  });
});

describe("Excel wall clock → CDMX instant", () => {
  it("feeds parseMxDateTime a string it can interpret as CDMX time", () => {
    const cell = new Date(Date.UTC(2026, 0, 15, 9, 0));
    const parsed = parseMxDateTime(excelDateToWallClock(cell));

    expect(parsed).toBeInstanceOf(Date);
    // 09:00 in CDMX, whatever the offset that day happens to be.
    expect(mxDateAndTime((parsed as Date).toISOString())).toEqual({
      date: "2026-01-15",
      time: "09:00",
    });
  });
});

describe("currentWeekRange", () => {
  it("returns the Monday→Sunday CDMX calendar week for a mid-week reference", () => {
    // 2026-06-10 is a Wednesday.
    const { start, end } = currentWeekRange(
      new Date("2026-06-10T12:00:00.000Z"),
    );
    expect(mxDateString(start)).toBe("2026-06-08"); // Monday
    expect(mxDateString(end)).toBe("2026-06-14"); // Sunday
  });
});

describe("mxDaysAgoString", () => {
  it("returns today's date for an offset of 0", () => {
    expect(mxDaysAgoString(0)).toBe(mxTodayString());
  });

  it("returns a YYYY-MM-DD formatted string", () => {
    expect(mxDaysAgoString(7)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("timezoneForState", () => {
  it("falls back to Mexico City for an unmapped state", () => {
    // Every state the system currently has centers in is Central.
    expect(timezoneForState("PUE")).toBe(APP_TZ);
    expect(timezoneForState("CDMX")).toBe(APP_TZ);
    expect(timezoneForState("QUE")).toBe(APP_TZ);
  });

  it("resolves the states that run on another clock", () => {
    expect(timezoneForState("SON")).toBe("America/Hermosillo");
    expect(timezoneForState("ROO")).toBe("America/Cancun");
    expect(timezoneForState("BCN")).toBe("America/Tijuana");
  });

  it("is case-insensitive", () => {
    expect(timezoneForState("son")).toBe("America/Hermosillo");
  });

  it("falls back when the state is missing entirely", () => {
    // Incident.clienteId is nullable, so this path is reachable.
    expect(timezoneForState(null)).toBe(APP_TZ);
    expect(timezoneForState(undefined)).toBe(APP_TZ);
    expect(timezoneForState("")).toBe(APP_TZ);
  });
});

describe("formatIncidentDateTime", () => {
  // 18:30 UTC — a mid-afternoon report, far from any midnight boundary so the
  // assertions stay DST-agnostic.
  const instant = new Date("2026-06-10T18:30:00.000Z");

  it("shows one time when the center is on Mexico City time", () => {
    const shown = formatIncidentDateTime(instant, "PUE");
    expect(shown).not.toContain("CDMX");
    expect(shown).toBe(
      instant.toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: APP_TZ,
      }),
    );
  });

  it("appends the CDMX time when the center is on another clock", () => {
    // Quintana Roo runs an hour ahead of Mexico City.
    const shown = formatIncidentDateTime(instant, "ROO");
    expect(shown).toContain("CDMX");

    const cancun = instant.toLocaleString("es-MX", {
      timeStyle: "short",
      timeZone: "America/Cancun",
    });
    const cdmx = instant.toLocaleString("es-MX", {
      timeStyle: "short",
      timeZone: APP_TZ,
    });
    expect(shown).toContain(cancun);
    expect(shown).toContain(cdmx);
    // The two really are different clocks, which is why both are shown.
    expect(cancun).not.toBe(cdmx);
  });

  it("shows the center's own time first, not the admin's", () => {
    const shown = formatIncidentDateTime(instant, "SON");
    const hermosillo = instant.toLocaleString("es-MX", {
      timeStyle: "short",
      timeZone: "America/Hermosillo",
    });
    expect(shown.startsWith(shown.split(" (")[0])).toBe(true);
    expect(shown.split(" (")[0]).toContain(hermosillo);
  });

  it("treats a center with no state as Mexico City", () => {
    expect(formatIncidentDateTime(instant, null)).toBe(
      formatIncidentDateTime(instant, "CDMX"),
    );
  });

  it("includes a time, not just a date", () => {
    // The whole point of the change: "reportado" needs the hour on it.
    expect(formatIncidentDateTime(instant, "CDMX")).toMatch(/\d{1,2}:\d{2}/);
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(formatIncidentDateTime(instant.toISOString(), "CDMX")).toBe(
      formatIncidentDateTime(instant, "CDMX"),
    );
  });
});

describe("datetime-local round trip", () => {
  it("shows the CDMX wall clock, not UTC", () => {
    // 18:30Z is 12:30 in Mexico City. The old `toISOString().slice(0,16)`
    // showed "18:30" here, and saving wrote that back.
    const shown = toDatetimeLocalMX(new Date("2026-06-10T18:30:00.000Z"));
    expect(shown).toBe("2026-06-10T12:30");
  });

  it("returns the same instant it was given", () => {
    const instant = new Date("2026-06-10T18:30:00.000Z");
    const restored = fromDatetimeLocalMX(toDatetimeLocalMX(instant));
    expect(restored?.getTime()).toBe(instant.getTime());
  });

  it("keeps an evening instant on its own CDMX day", () => {
    // 01:00Z on the 11th is still 19:00 on the 10th in CDMX.
    expect(toDatetimeLocalMX(new Date("2026-06-11T01:00:00.000Z"))).toBe(
      "2026-06-10T19:00",
    );
  });

  it("treats empty input as no value in both directions", () => {
    expect(toDatetimeLocalMX(null)).toBe("");
    expect(toDatetimeLocalMX(undefined)).toBe("");
    expect(fromDatetimeLocalMX("")).toBeNull();
  });

  it("ignores a malformed stored value instead of rendering NaN", () => {
    expect(toDatetimeLocalMX("not-a-date")).toBe("");
  });
});

describe("date input round trip", () => {
  it("keeps an evening instant on its own CDMX day", () => {
    expect(toDateInputMX(new Date("2026-06-11T01:00:00.000Z"))).toBe(
      "2026-06-10",
    );
  });

  it("round-trips a picked day back to that CDMX day", () => {
    const picked = fromDateInputMX("2026-06-10");
    expect(picked).not.toBeNull();
    expect(toDateInputMX(picked as Date)).toBe("2026-06-10");
  });

  it("treats empty input as no value", () => {
    expect(toDateInputMX(null)).toBe("");
    expect(fromDateInputMX("")).toBeNull();
  });
});

describe("formatMX", () => {
  it("keeps a late-evening instant on its own CDMX day", () => {
    // This is the vacation endDate case: `mxDayRange(...).lte` is the CDMX end
    // of day, which in UTC is already the next morning. Rendered without a zone
    // it showed every vacation ending a day late.
    const endOfDay = mxDayRange("2026-06-14").lte;
    expect(endOfDay.toISOString().slice(0, 10)).toBe("2026-06-15"); // UTC says the 15th
    expect(formatMX(endOfDay, { dateStyle: "short" })).toContain("14");
  });

  it("renders the same string on any host clock", () => {
    // Pure Intl with an explicit zone, so server and browser agree — which is
    // what removes the hydration mismatch risk in client components.
    const instant = new Date("2026-06-10T18:30:00.000Z");
    expect(formatMX(instant)).toBe(
      instant.toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: APP_TZ,
      }),
    );
  });
});

describe("mxHour", () => {
  it("reports the CDMX hour, not the host's", () => {
    // 18:30Z is 12:30 in Mexico City.
    expect(mxHour(new Date("2026-06-10T18:30:00.000Z"))).toBe(12);
  });

  it("keeps a late-evening instant in the previous day's hours", () => {
    // 01:00Z on the 11th is 19:00 on the 10th in CDMX — the agenda row it
    // belongs in.
    expect(mxHour(new Date("2026-06-11T01:00:00.000Z"))).toBe(19);
  });
});
