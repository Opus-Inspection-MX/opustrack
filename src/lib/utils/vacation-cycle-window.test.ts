import { describe, expect, it } from "vitest";
import {
  anniversaryVacationWindow,
  calendarVacationWindow,
  isCalendarGrantAvailable,
  isVacationPeriodUsable,
} from "./vacation-cycle-window";

describe("anniversaryVacationWindow", () => {
  it("grants only on the anniversary and closes before the next, with configurable grace", () => {
    const hire = new Date("2020-06-15T06:00:00Z");
    const window = anniversaryVacationWindow(hire, 2026, 0);
    expect(window).toMatchObject({
      periodNumber: 6,
      accrualStart: new Date("2026-06-15T06:00:00Z"),
      accrualEnd: new Date("2027-06-15T05:59:59.999Z"),
      graceEnd: new Date("2027-06-15T05:59:59.999Z"),
    });
    expect(anniversaryVacationWindow(hire, 2026, 3)?.graceEnd).toEqual(
      new Date("2027-09-15T05:59:59.999Z"),
    );
    expect(anniversaryVacationWindow(hire, 2020, 0)).toBeNull();
  });
  it("resolves the next leap anniversary independently without losing February 28", () => {
    const hire = new Date("2020-02-29T06:00:00Z");
    expect(anniversaryVacationWindow(hire, 2023, 0)?.accrualEnd).toEqual(
      new Date("2024-02-29T05:59:59.999Z"),
    );
    expect(anniversaryVacationWindow(hire, 2024, 0)?.accrualStart).toEqual(
      new Date("2024-02-29T06:00:00Z"),
    );
  });
});

describe("calendarVacationWindow", () => {
  it("separates Jan 1 accrual from anniversary activation and Dec 31 closure", () => {
    const window = calendarVacationWindow(
      new Date("2020-06-15T20:00:00Z"),
      2026,
      12,
    );
    expect(window).toEqual({
      cycleYear: 2026,
      periodNumber: 6,
      accrualStart: new Date("2026-01-01T06:00:00.000Z"),
      accrualEnd: new Date("2027-01-01T05:59:59.999Z"),
      availableFrom: new Date("2026-06-15T06:00:00.000Z"),
      graceEnd: new Date("2028-01-01T05:59:59.999Z"),
    });
    if (!window) throw new Error("Expected calendar window");
    expect(
      isCalendarGrantAvailable(window, new Date("2026-06-15T05:59:59.999Z")),
    ).toBe(false);
    expect(
      isCalendarGrantAvailable(window, new Date("2026-06-15T06:00:00.000Z")),
    ).toBe(true);
    expect(
      isCalendarGrantAvailable(window, new Date("2028-01-01T05:59:59.999Z")),
    ).toBe(true);
    expect(
      isCalendarGrantAvailable(window, new Date("2028-01-01T06:00:00.000Z")),
    ).toBe(false);
  });

  it("blocks the hire-year grant and activates tier one on the first completed anniversary", () => {
    const hire = new Date("2026-10-05T03:00:00Z"); // Oct 4 in CDMX
    const first = calendarVacationWindow(hire, 2027, 0);
    const second = calendarVacationWindow(hire, 2028, 0);
    expect(calendarVacationWindow(hire, 2026, 0)).toBeNull();
    expect(first?.periodNumber).toBe(1);
    expect(first?.availableFrom).toEqual(new Date("2027-10-04T06:00:00Z"));
    expect(second?.periodNumber).toBe(2);
    expect(second?.accrualStart).toEqual(new Date("2028-01-01T06:00:00Z"));
    expect(calendarVacationWindow(hire, 2025, 0)).toBeNull();
    if (!first) throw new Error("Expected first completed-anniversary window");
    expect(
      isCalendarGrantAvailable(first, new Date("2027-10-04T05:59:59.999Z")),
    ).toBe(false);
    expect(
      isCalendarGrantAvailable(first, new Date("2027-10-04T06:00:00.000Z")),
    ).toBe(true);
  });

  it("keeps year-edge anniversaries inside the correct cycle", () => {
    const jan = calendarVacationWindow(
      new Date("2020-01-01T06:00:00Z"),
      2026,
      0,
    );
    const dec = calendarVacationWindow(
      new Date("2020-12-31T06:00:00Z"),
      2026,
      0,
    );
    expect(jan?.availableFrom).toEqual(jan?.accrualStart);
    expect(dec?.availableFrom).toEqual(new Date("2026-12-31T06:00:00Z"));
    if (!dec) throw new Error("Expected December window");
    expect(
      isCalendarGrantAvailable(dec, new Date("2026-12-31T05:59:59Z")),
    ).toBe(false);
    expect(
      isCalendarGrantAvailable(dec, new Date("2026-12-31T06:00:00Z")),
    ).toBe(true);
  });

  it("uses Feb 28 in common years and Feb 29 in leap years", () => {
    const hire = new Date("2020-02-29T06:00:00Z");
    expect(calendarVacationWindow(hire, 2024, 12)?.availableFrom).toEqual(
      new Date("2024-02-29T06:00:00Z"),
    );
    expect(calendarVacationWindow(hire, 2025, 12)?.availableFrom).toEqual(
      new Date("2025-02-28T06:00:00Z"),
    );
  });

  it("fails closed for missing or invalid dates", () => {
    expect(calendarVacationWindow(null, 2026, 12)).toBeNull();
    expect(calendarVacationWindow(new Date("invalid"), 2026, 12)).toBeNull();
    expect(
      calendarVacationWindow(new Date("2020-01-01T06:00:00Z"), 2026, -1),
    ).toBeNull();
  });
});

describe("isVacationPeriodUsable", () => {
  const now = new Date("2026-06-15T06:00:00Z");
  const period = {
    cycleYear: 2026,
    availableFrom: now,
    graceEnd: new Date("2027-01-01T05:59:59.999Z"),
    remainingDays: 12,
    isExpired: false,
  };

  it("opens exactly at the CDMX anniversary and fails closed without activation", () => {
    expect(isVacationPeriodUsable(period, new Date(now.getTime() - 1))).toBe(
      false,
    );
    expect(isVacationPeriodUsable(period, now)).toBe(true);
    expect(
      isVacationPeriodUsable({ ...period, availableFrom: null }, now),
    ).toBe(false);
    expect(
      isVacationPeriodUsable(
        { ...period, availableFrom: new Date("invalid") },
        now,
      ),
    ).toBe(false);
  });

  it("preserves usable legacy grants but excludes expired or fully reserved periods", () => {
    expect(
      isVacationPeriodUsable(
        { ...period, cycleYear: null, availableFrom: null },
        now,
      ),
    ).toBe(true);
    expect(isVacationPeriodUsable({ ...period, remainingDays: 0 }, now)).toBe(
      false,
    );
    expect(
      isVacationPeriodUsable(
        { ...period, graceEnd: new Date(now.getTime() - 1) },
        now,
      ),
    ).toBe(false);
  });
});
