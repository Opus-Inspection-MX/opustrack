import type { VacationPeriod } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Prisma singleton BEFORE importing the module under test.
vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    vacationSetting: { findUnique: vi.fn() },
    vacationAccrualRule: { findFirst: vi.fn() },
    vacationPeriod: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    vacation: { aggregate: vi.fn() },
  },
}));

import { prisma } from "@/lib/database/prisma.singleton";
import {
  allottedDaysFor,
  ensurePeriodsUpToNow,
  getPeriodBalance,
  isPeriodRequestable,
  recomputePeriodsForNewHireDate,
  resolveVacationPeriod,
} from "./vacation-periods";

const userFindUnique = vi.mocked(prisma.user.findUnique);
const settingFindUnique = vi.mocked(prisma.vacationSetting.findUnique);
const ruleFindFirst = vi.mocked(prisma.vacationAccrualRule.findFirst);
const periodUpsert = vi.mocked(prisma.vacationPeriod.upsert);
const periodFindMany = vi.mocked(prisma.vacationPeriod.findMany);
const periodFindUnique = vi.mocked(prisma.vacationPeriod.findUnique);
const periodUpdate = vi.mocked(prisma.vacationPeriod.update);
const periodDelete = vi.mocked(prisma.vacationPeriod.delete);
const vacationAggregate = vi.mocked(prisma.vacation.aggregate);

/** A CDMX calendar day as the UTC instant of its 00:00 (CDMX is UTC-6). */
function mxDay(dateStr: string): Date {
  return new Date(`${dateStr}T06:00:00.000Z`);
}

function makePeriod(overrides: Partial<VacationPeriod>): VacationPeriod {
  return {
    id: "period-1",
    userId: "user-1",
    periodNumber: 1,
    accrualStart: mxDay("2020-01-01"),
    accrualEnd: mxDay("2020-12-31"),
    graceEnd: mxDay("2021-12-31"),
    ruleDays: 12,
    overrideDays: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as VacationPeriod;
}

beforeEach(() => {
  vi.clearAllMocks();
  settingFindUnique.mockResolvedValue({ graceWindowMonths: 12 } as never);
});

describe("allottedDaysFor", () => {
  it("uses the rule days when there is no override", () => {
    expect(allottedDaysFor(makePeriod({ ruleDays: 12 }))).toBe(12);
  });

  it("lets an admin override replace the rule days", () => {
    expect(
      allottedDaysFor(makePeriod({ ruleDays: 12, overrideDays: 20 })),
    ).toBe(20);
  });

  it("honours an override of zero rather than falling back to the rule", () => {
    expect(allottedDaysFor(makePeriod({ ruleDays: 12, overrideDays: 0 }))).toBe(
      0,
    );
  });
});

describe("isPeriodRequestable", () => {
  const period = makePeriod({
    accrualStart: mxDay("2026-01-01"),
    accrualEnd: mxDay("2026-12-31"),
    graceEnd: mxDay("2027-12-31"),
  });

  it("accepts a date inside the accrual window", () => {
    expect(isPeriodRequestable(period, mxDay("2026-06-15"))).toBe(true);
  });

  it("accepts a date inside the grace window", () => {
    expect(isPeriodRequestable(period, mxDay("2027-06-15"))).toBe(true);
  });

  it("rejects a date before accrual starts", () => {
    expect(isPeriodRequestable(period, mxDay("2025-12-31"))).toBe(false);
  });

  it("rejects a date after grace ends", () => {
    expect(isPeriodRequestable(period, mxDay("2028-01-01"))).toBe(false);
  });
});

describe("getPeriodBalance", () => {
  it("derives remaining days from allotted minus consumed", () => {
    periodFindUnique.mockResolvedValue(makePeriod({ ruleDays: 12 }) as never);
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: 5 },
    } as never);

    return expect(getPeriodBalance("period-1")).resolves.toEqual({
      allottedDays: 12,
      usedDays: 5,
      remainingDays: 7,
    });
  });

  it("treats a period with no requests as fully available", () => {
    periodFindUnique.mockResolvedValue(makePeriod({ ruleDays: 12 }) as never);
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: null },
    } as never);

    return expect(getPeriodBalance("period-1")).resolves.toEqual({
      allottedDays: 12,
      usedDays: 0,
      remainingDays: 12,
    });
  });

  it("counts only PENDIENTE and APROBADA requests as consuming days", async () => {
    periodFindUnique.mockResolvedValue(makePeriod({}) as never);
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: 3 },
    } as never);

    await getPeriodBalance("period-1");

    expect(vacationAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodId: "period-1",
          active: true,
          status: { name: { in: ["PENDIENTE", "APROBADA"] } },
        }),
      }),
    );
  });

  it("raises remaining days when an override increases the allotment", () => {
    // The non-destructive invariant: same consumed days, more available.
    periodFindUnique.mockResolvedValue(
      makePeriod({ ruleDays: 12, overrideDays: 20 }) as never,
    );
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: 5 },
    } as never);

    return expect(getPeriodBalance("period-1")).resolves.toEqual({
      allottedDays: 20,
      usedDays: 5,
      remainingDays: 15,
    });
  });
});

describe("ensurePeriodsUpToNow", () => {
  it("returns nothing when the user has no hire date", async () => {
    userFindUnique.mockResolvedValue({ hireDate: null } as never);

    expect(await ensurePeriodsUpToNow("user-1")).toEqual([]);
    expect(periodUpsert).not.toHaveBeenCalled();
  });

  it("creates one period per elapsed year of service", async () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    userFindUnique.mockResolvedValue({ hireDate: twoYearsAgo } as never);
    ruleFindFirst.mockResolvedValue({ days: 12 } as never);
    periodUpsert.mockResolvedValue({} as never);
    periodFindMany.mockResolvedValue([] as never);

    await ensurePeriodsUpToNow("user-1");

    // Two full years elapsed plus the currently-accruing third.
    expect(periodUpsert).toHaveBeenCalledTimes(3);
  });

  it("never overwrites an existing period when re-run", async () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    userFindUnique.mockResolvedValue({ hireDate: oneYearAgo } as never);
    ruleFindFirst.mockResolvedValue({ days: 12 } as never);
    periodUpsert.mockResolvedValue({} as never);
    periodFindMany.mockResolvedValue([] as never);

    await ensurePeriodsUpToNow("user-1");

    // An empty `update` is what protects overrideDays and the snapshotted window.
    for (const call of periodUpsert.mock.calls) {
      expect(call[0].update).toEqual({});
    }
  });

  it("skips a year of service that no accrual rule covers", async () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    userFindUnique.mockResolvedValue({ hireDate: oneYearAgo } as never);
    ruleFindFirst.mockResolvedValue(null);
    periodFindMany.mockResolvedValue([] as never);

    await ensurePeriodsUpToNow("user-1");

    expect(periodUpsert).not.toHaveBeenCalled();
  });
});

describe("resolveVacationPeriod", () => {
  const period1 = makePeriod({
    id: "p1",
    periodNumber: 1,
    accrualStart: mxDay("2026-01-01"),
    accrualEnd: mxDay("2026-12-31"),
    graceEnd: mxDay("2027-12-31"),
  });
  const period2 = makePeriod({
    id: "p2",
    periodNumber: 2,
    accrualStart: mxDay("2027-01-01"),
    accrualEnd: mxDay("2027-12-31"),
    graceEnd: mxDay("2028-12-31"),
  });

  function havePeriods(periods: VacationPeriod[]) {
    userFindUnique.mockResolvedValue({
      hireDate: mxDay("2026-01-01"),
    } as never);
    ruleFindFirst.mockResolvedValue({ days: 12 } as never);
    periodUpsert.mockResolvedValue({} as never);
    periodFindMany.mockResolvedValue(periods as never);
  }

  it("resolves a range that sits inside the accrual window", async () => {
    havePeriods([period1, period2]);

    const resolved = await resolveVacationPeriod(
      "user-1",
      mxDay("2026-06-01"),
      mxDay("2026-06-05"),
    );

    expect(resolved.id).toBe("p1");
  });

  it("resolves a range that starts in accrual and ends in the same period's grace", async () => {
    // Grace is part of the same period, not a separate one.
    havePeriods([period1]);

    const resolved = await resolveVacationPeriod(
      "user-1",
      mxDay("2026-12-28"),
      mxDay("2027-01-05"),
    );

    expect(resolved.id).toBe("p1");
  });

  it("charges the period the user explicitly picked", async () => {
    // The balance panel shows a specific period's remaining days, so the
    // request has to come out of that one — otherwise the number the user was
    // looking at is not the number that changes.
    havePeriods([period1, period2]);

    const resolved = await resolveVacationPeriod(
      "user-1",
      mxDay("2027-06-01"),
      mxDay("2027-06-05"),
      undefined,
      "p2",
    );

    expect(resolved.id).toBe("p2");
  });

  it("rejects a picked period whose window does not cover the range", async () => {
    havePeriods([period1, period2]);

    await expect(
      resolveVacationPeriod(
        "user-1",
        mxDay("2028-06-01"),
        mxDay("2028-06-05"),
        undefined,
        "p1",
      ),
    ).rejects.toThrow(/fuera de la vigencia del período 1/);
  });

  it("prefers the older period when no period was picked", async () => {
    // Accrual and grace windows overlap by design, so a range can be payable
    // from either period. Spending the older one first is what stops days from
    // expiring unused.
    havePeriods([period1, period2]);

    const resolved = await resolveVacationPeriod(
      "user-1",
      mxDay("2027-06-01"),
      mxDay("2027-06-05"),
    );

    expect(resolved.id).toBe("p1");
  });

  it("rejects a range that spans two periods", async () => {
    havePeriods([period1, period2]);

    // Starts before period 2 opens and ends after period 1's grace closes, so
    // no single period can cover it.
    await expect(
      resolveVacationPeriod("user-1", mxDay("2026-06-01"), mxDay("2028-06-01")),
    ).rejects.toThrow(/abarca dos períodos/);
  });

  it("rejects a range outside every period's window", async () => {
    havePeriods([period1, period2]);

    await expect(
      resolveVacationPeriod("user-1", mxDay("2035-01-01"), mxDay("2035-01-05")),
    ).rejects.toThrow(/no caen dentro de ningún período/);
  });

  it("rejects when the user has no hire date", async () => {
    userFindUnique.mockResolvedValue({ hireDate: null } as never);

    await expect(
      resolveVacationPeriod("user-1", mxDay("2026-06-01"), mxDay("2026-06-05")),
    ).rejects.toThrow(/fecha de contratación/);
  });
});

describe("recomputePeriodsForNewHireDate", () => {
  it("does nothing when the user has no periods yet", async () => {
    periodFindMany.mockResolvedValue([] as never);

    await recomputePeriodsForNewHireDate("user-1", mxDay("2026-01-01"));

    expect(periodUpdate).not.toHaveBeenCalled();
  });

  it("shifts period windows onto the corrected hire date", async () => {
    periodFindMany.mockResolvedValue([
      { ...makePeriod({ id: "p1", periodNumber: 1 }), vacations: [] },
    ] as never);
    periodUpdate.mockResolvedValue({} as never);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    await recomputePeriodsForNewHireDate("user-1", oneYearAgo);

    expect(periodUpdate).toHaveBeenCalledTimes(1);
  });

  it("refuses to strand an existing vacation outside its period", async () => {
    periodFindMany.mockResolvedValue([
      {
        ...makePeriod({
          id: "p1",
          periodNumber: 1,
          accrualStart: mxDay("2020-01-01"),
          graceEnd: mxDay("2021-12-31"),
        }),
        vacations: [
          {
            id: "v1",
            startDate: mxDay("2020-06-01"),
            endDate: mxDay("2020-06-05"),
            reason: null,
          },
        ],
      },
    ] as never);

    // Moving the hire date forward by years leaves the 2020 vacation outside.
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 1);

    await expect(
      recomputePeriodsForNewHireDate("user-1", recent),
    ).rejects.toThrow(/solicitud de vacaciones/);
    expect(periodUpdate).not.toHaveBeenCalled();
  });

  it("refuses to drop a period that still has vacations attached", async () => {
    periodFindMany.mockResolvedValue([
      {
        ...makePeriod({ id: "p3", periodNumber: 3 }),
        vacations: [
          {
            id: "v1",
            startDate: mxDay("2022-06-01"),
            endDate: mxDay("2022-06-05"),
            reason: null,
          },
        ],
      },
    ] as never);

    // A hire date of today leaves only period 1, so period 3 would vanish.
    await expect(
      recomputePeriodsForNewHireDate("user-1", new Date()),
    ).rejects.toThrow(/elimina el período 3/);
    expect(periodDelete).not.toHaveBeenCalled();
  });
});
