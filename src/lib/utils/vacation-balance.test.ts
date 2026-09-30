import { describe, expect, it } from "vitest";
import { countBusinessDaysSync } from "./vacation-balance";

/**
 * The pure counter is the one that decides what a vacation request costs, so
 * these cases pin down the rules: Saturdays count, Sundays and active holidays
 * do not, and the range is inclusive on both ends.
 *
 * Dates are built through `mxDay` so the assertions read as CDMX calendar days
 * rather than UTC instants — a request "for June 10th" must cost the same
 * whether the server sits in Mexico City or UTC.
 */

/** A CDMX calendar day as the UTC instant of its 00:00. */
function mxDay(dateStr: string): Date {
  // CDMX is UTC-6, so local midnight is 06:00Z the same day.
  return new Date(`${dateStr}T06:00:00.000Z`);
}

const NO_HOLIDAYS: ReadonlySet<string> = new Set();

// June 2026: 1st is a Monday, so weekends fall on 6-7, 13-14, 20-21, 27-28.
describe("countBusinessDaysSync", () => {
  it("counts a single weekday as one day", () => {
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-10"),
        mxDay("2026-06-10"),
        NO_HOLIDAYS,
      ),
    ).toBe(1);
  });

  it("charges a single Saturday but not a single Sunday", () => {
    // 2026-06-13 is a Saturday, 2026-06-14 a Sunday.
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-13"),
        mxDay("2026-06-13"),
        NO_HOLIDAYS,
      ),
    ).toBe(1);
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-14"),
        mxDay("2026-06-14"),
        NO_HOLIDAYS,
      ),
    ).toBe(0);
  });

  it("counts a full Monday-to-Friday week as five days", () => {
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-08"),
        mxDay("2026-06-12"),
        NO_HOLIDAYS,
      ),
    ).toBe(5);
  });

  it("excludes only Sundays inside a two-week range", () => {
    // Mon 8th → Fri 19th spans 12 calendar days, including one Sunday.
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-08"),
        mxDay("2026-06-19"),
        NO_HOLIDAYS,
      ),
    ).toBe(11);
  });

  it("charges a range starting on Saturday but skips Sunday", () => {
    // Sat 13th → Tue 16th: Sat, Mon and Tue are chargeable.
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-13"),
        mxDay("2026-06-16"),
        NO_HOLIDAYS,
      ),
    ).toBe(3);
  });

  it("ignores a range that ends on a Sunday", () => {
    // Thu 11th → Sun 14th: Thu, Fri and Sat only.
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-11"),
        mxDay("2026-06-14"),
        NO_HOLIDAYS,
      ),
    ).toBe(3);
  });

  it("does not charge a holiday that falls on a weekday", () => {
    const holidays = new Set(["2026-06-10"]);
    expect(
      countBusinessDaysSync(mxDay("2026-06-08"), mxDay("2026-06-12"), holidays),
    ).toBe(4);
  });

  it("counts zero when the only day requested is a holiday", () => {
    const holidays = new Set(["2026-06-10"]);
    expect(
      countBusinessDaysSync(mxDay("2026-06-10"), mxDay("2026-06-10"), holidays),
    ).toBe(0);
  });

  it("excludes a holiday Saturday exactly once", () => {
    const holidays = new Set(["2026-06-13"]);
    expect(
      countBusinessDaysSync(mxDay("2026-06-13"), mxDay("2026-06-13"), holidays),
    ).toBe(0);
    expect(
      countBusinessDaysSync(mxDay("2026-06-08"), mxDay("2026-06-19"), holidays),
    ).toBe(10);
  });

  it("combines Sunday and holiday exclusions over a long range", () => {
    // Mon 1st → Fri 19th: 17 Monday–Saturday days, minus two holidays.
    const holidays = new Set(["2026-06-01", "2026-06-17"]);
    expect(
      countBusinessDaysSync(mxDay("2026-06-01"), mxDay("2026-06-19"), holidays),
    ).toBe(15);
  });

  it("returns zero for an inverted range", () => {
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-19"),
        mxDay("2026-06-08"),
        NO_HOLIDAYS,
      ),
    ).toBe(0);
  });

  it("counts across a year boundary", () => {
    // Wed 2026-12-30 → Fri 2027-01-01, with New Year's Day a holiday:
    // Wed 30th and Thu 31st are chargeable, Fri 1st is not.
    const holidays = new Set(["2027-01-01"]);
    expect(
      countBusinessDaysSync(mxDay("2026-12-30"), mxDay("2027-01-01"), holidays),
    ).toBe(2);
  });

  it("counts a Saturday across New Year without charging Sunday or holidays in either year", () => {
    // Thu 2026-12-31 → Mon 2027-01-04: only Sat counts.
    const holidays = new Set(["2026-12-31", "2027-01-01", "2027-01-04"]);
    expect(
      countBusinessDaysSync(mxDay("2026-12-31"), mxDay("2027-01-04"), holidays),
    ).toBe(1);
  });

  it("uses CDMX calendar dates for UTC instants near midnight", () => {
    // UTC Sunday is still Saturday in CDMX; UTC Monday is still Sunday.
    expect(
      countBusinessDaysSync(
        new Date("2026-06-14T01:00:00.000Z"),
        new Date("2026-06-15T01:00:00.000Z"),
        NO_HOLIDAYS,
      ),
    ).toBe(1);
  });
});
