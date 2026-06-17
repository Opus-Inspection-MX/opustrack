import { describe, expect, it } from "vitest";
import {
  currentWeekRange,
  localWallTimeToUTC,
  mxDateAndTime,
  mxDateString,
  mxDayRange,
  mxDaysAgoString,
  mxTodayString,
  parseMxDateTime,
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
