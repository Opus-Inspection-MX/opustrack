import type { Holiday } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Prisma singleton BEFORE importing the module under test.
vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    holiday: { findMany: vi.fn() },
    vacation: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/database/prisma.singleton";
import {
  holidayRuleMatchesDate,
  isFsrUnavailable,
  isHoliday,
  unavailableFsrsForDate,
} from "./availability";

const findMany = vi.mocked(prisma.holiday.findMany);
const findFirst = vi.mocked(prisma.vacation.findFirst);

/**
 * Build a Holiday row. Only the fields read by holidayRuleMatchesDate matter;
 * the rest are filled with sensible defaults.
 */
function makeHoliday(overrides: Partial<Holiday>): Holiday {
  return {
    id: 1,
    name: "Test Holiday",
    month: 1,
    day: null,
    nthMonday: null,
    isRecurring: true,
    year: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Holiday;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("holidayRuleMatchesDate (pure)", () => {
  describe("fixed-date recurring rule", () => {
    const newYear = makeHoliday({ month: 1, day: 1, isRecurring: true });

    it("matches the exact day", () => {
      expect(holidayRuleMatchesDate(newYear, "2026-01-01")).toBe(true);
    });

    it("does not match a different day in the same month", () => {
      expect(holidayRuleMatchesDate(newYear, "2026-01-02")).toBe(false);
    });

    it("does not match a different month", () => {
      expect(holidayRuleMatchesDate(newYear, "2026-02-01")).toBe(false);
    });

    it("matches any year because it is recurring", () => {
      expect(holidayRuleMatchesDate(newYear, "2030-01-01")).toBe(true);
      expect(holidayRuleMatchesDate(newYear, "2099-01-01")).toBe(true);
    });
  });

  describe("n-th Monday rule", () => {
    // First Monday of February 2026 is the 2nd (Feb 1 2026 is a Sunday).
    const firstMondayFeb = makeHoliday({ month: 2, nthMonday: 1, day: null });
    // Third Monday of March 2026 is the 16th.
    const thirdMondayMarch = makeHoliday({ month: 3, nthMonday: 3, day: null });

    it("matches the first Monday of the month", () => {
      expect(holidayRuleMatchesDate(firstMondayFeb, "2026-02-02")).toBe(true);
    });

    it("does not match the second Monday for a first-Monday rule", () => {
      expect(holidayRuleMatchesDate(firstMondayFeb, "2026-02-09")).toBe(false);
    });

    it("does not match a non-Monday weekday", () => {
      // Feb 3 2026 is a Tuesday.
      expect(holidayRuleMatchesDate(firstMondayFeb, "2026-02-03")).toBe(false);
    });

    it("matches the third Monday of the month", () => {
      expect(holidayRuleMatchesDate(thirdMondayMarch, "2026-03-16")).toBe(true);
    });

    it("does not match a different ordinal Monday", () => {
      // Mar 9 2026 is the second Monday.
      expect(holidayRuleMatchesDate(thirdMondayMarch, "2026-03-09")).toBe(
        false,
      );
    });
  });

  describe("one-time (sexennial) rule", () => {
    // Transmisión de poder: Oct 1, only in 2024.
    const transfer = makeHoliday({
      month: 10,
      day: 1,
      isRecurring: false,
      year: 2024,
    });

    it("matches only in the configured year", () => {
      expect(holidayRuleMatchesDate(transfer, "2024-10-01")).toBe(true);
    });

    it("does not match the same date in a different year", () => {
      expect(holidayRuleMatchesDate(transfer, "2030-10-01")).toBe(false);
    });

    it("does not match a different day within the configured year", () => {
      expect(holidayRuleMatchesDate(transfer, "2024-10-02")).toBe(false);
    });

    it("ignores the year guard when year is null", () => {
      const noYear = makeHoliday({
        month: 10,
        day: 1,
        isRecurring: false,
        year: null,
      });
      expect(holidayRuleMatchesDate(noYear, "2030-10-01")).toBe(true);
    });
  });

  describe("malformed rule", () => {
    it("returns false when neither day nor nthMonday is set", () => {
      const broken = makeHoliday({ month: 5, day: null, nthMonday: null });
      expect(holidayRuleMatchesDate(broken, "2026-05-10")).toBe(false);
    });
  });
});

describe("isHoliday", () => {
  it("narrows the query to active rules for the matching month", async () => {
    findMany.mockResolvedValue([]);

    await isHoliday("2026-01-15");

    expect(findMany).toHaveBeenCalledWith({
      where: { active: true, month: 1 },
    });
  });

  it("returns true when at least one rule matches the date", async () => {
    findMany.mockResolvedValue([makeHoliday({ month: 1, day: 1 })]);

    expect(await isHoliday("2026-01-01")).toBe(true);
  });

  it("returns false when no rule matches the date", async () => {
    findMany.mockResolvedValue([makeHoliday({ month: 1, day: 1 })]);

    expect(await isHoliday("2026-01-02")).toBe(false);
  });
});

describe("isFsrUnavailable", () => {
  // Noon UTC keeps the CDMX calendar day unambiguous (UTC-6).
  const jan1 = new Date("2026-01-01T12:00:00.000Z");

  it("returns true when the day is a holiday, without checking vacations", async () => {
    findMany.mockResolvedValue([makeHoliday({ month: 1, day: 1 })]);

    expect(await isFsrUnavailable("user-1", jan1)).toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns true when an approved vacation covers the day", async () => {
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue({ id: 99 } as never);

    expect(await isFsrUnavailable("user-1", jan1)).toBe(true);
  });

  it("only counts APROBADA vacations as blocking", async () => {
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue(null);

    await isFsrUnavailable("user-1", jan1);

    const where = findFirst.mock.calls[0]?.[0]?.where as {
      status: { name: string };
    };
    expect(where.status).toEqual({ name: "APROBADA" });
  });

  it("returns false when there is no holiday and no approved vacation", async () => {
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue(null);

    expect(await isFsrUnavailable("user-1", jan1)).toBe(false);
  });
});

describe("unavailableFsrsForDate", () => {
  const jan1 = new Date("2026-01-01T12:00:00.000Z");

  it("returns an empty set for an empty user list", async () => {
    const result = await unavailableFsrsForDate([], jan1);

    expect(result.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns only the unavailable subset of users", async () => {
    findMany.mockResolvedValue([]);
    findFirst.mockImplementation((async (args: {
      where: { userId: string };
    }) => (args.where.userId === "u1" ? { id: 1 } : null)) as never);

    const result = await unavailableFsrsForDate(["u1", "u2"], jan1);

    expect(result.has("u1")).toBe(true);
    expect(result.has("u2")).toBe(false);
    expect(result.size).toBe(1);
  });
});
