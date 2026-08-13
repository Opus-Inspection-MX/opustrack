import { describe, expect, it } from "vitest";
import { countBusinessDaysSync } from "./vacation-balance";

/**
 * The pure counter is the one that decides what a vacation request costs, so
 * these cases pin down the rules a user would argue about: weekends are free,
 * holidays are free, and the range is inclusive on both ends.
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

  it("counts a single weekend day as zero", () => {
    // 2026-06-13 is a Saturday, 2026-06-14 a Sunday.
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-13"),
        mxDay("2026-06-13"),
        NO_HOLIDAYS,
      ),
    ).toBe(0);
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

  it("excludes the weekend inside a two-week range", () => {
    // Mon 8th → Fri 19th spans 12 calendar days, 2 of them a weekend.
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-08"),
        mxDay("2026-06-19"),
        NO_HOLIDAYS,
      ),
    ).toBe(10);
  });

  it("ignores a range that starts on a Saturday until the weekday arrives", () => {
    // Sat 13th → Tue 16th: only Mon 15th and Tue 16th are chargeable.
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-13"),
        mxDay("2026-06-16"),
        NO_HOLIDAYS,
      ),
    ).toBe(2);
  });

  it("ignores a range that ends on a Sunday", () => {
    // Thu 11th → Sun 14th: Thu and Fri only.
    expect(
      countBusinessDaysSync(
        mxDay("2026-06-11"),
        mxDay("2026-06-14"),
        NO_HOLIDAYS,
      ),
    ).toBe(2);
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

  it("does not double-discount a holiday that lands on a weekend", () => {
    // Sat 13th is already free; marking it a holiday changes nothing.
    const holidays = new Set(["2026-06-13"]);
    expect(
      countBusinessDaysSync(mxDay("2026-06-08"), mxDay("2026-06-19"), holidays),
    ).toBe(10);
  });

  it("combines weekend and holiday exclusions over a long range", () => {
    // Mon 1st → Fri 19th: 15 weekdays, minus two holidays on weekdays.
    const holidays = new Set(["2026-06-01", "2026-06-17"]);
    expect(
      countBusinessDaysSync(mxDay("2026-06-01"), mxDay("2026-06-19"), holidays),
    ).toBe(13);
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
});
