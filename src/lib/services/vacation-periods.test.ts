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
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    vacation: { aggregate: vi.fn(), findMany: vi.fn() },
    historicalVacationConsumption: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/database/prisma.singleton";

vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction: (run: (tx: unknown) => unknown) =>
    run({ ...prisma }),
}));

import {
  allottedDaysFor,
  ensureCalendarPeriodsForUser,
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
const periodFindFirst = vi.mocked(prisma.vacationPeriod.findFirst);
const periodFindUnique = vi.mocked(prisma.vacationPeriod.findUnique);
const periodUpdate = vi.mocked(prisma.vacationPeriod.update);
const periodDelete = vi.mocked(prisma.vacationPeriod.delete);
const vacationAggregate = vi.mocked(prisma.vacation.aggregate);
const vacationFindMany = vi.mocked(prisma.vacation.findMany);
const historicalFindMany = vi.mocked(
  prisma.historicalVacationConsumption.findMany,
);

/** A CDMX calendar day as the UTC instant of its 00:00 (CDMX is UTC-6). */
function mxDay(dateStr: string): Date {
  return new Date(`${dateStr}T06:00:00.000Z`);
}

function makePeriod(overrides: Partial<VacationPeriod>): VacationPeriod {
  return {
    id: "period-1",
    userId: "user-1",
    periodNumber: 1,
    cycleYear: null,
    availableFrom: null,
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

/** A calendar-cycle period: Jan–Dec accrual with anniversary activation. */
function makeCalendarPeriod(overrides: Partial<VacationPeriod>) {
  return makePeriod({
    id: "cal-2026",
    periodNumber: 6,
    cycleYear: 2026,
    availableFrom: mxDay("2026-06-15"),
    accrualStart: mxDay("2026-01-01"),
    accrualEnd: mxDay("2026-12-31"),
    graceEnd: new Date("2027-01-01T05:59:59.999Z"),
    ruleDays: 14,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  settingFindUnique.mockResolvedValue({ graceWindowMonths: 12 } as never);
  historicalFindMany.mockResolvedValue([] as never);
  periodFindFirst.mockResolvedValue(null as never);
  periodFindMany.mockResolvedValue([] as never);
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
  it("excludes only the trusted request from aggregate reservations", async () => {
    periodFindUnique.mockResolvedValue(makePeriod({ ruleDays: 3 }) as never);
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: 1 },
    } as never);
    expect(
      await getPeriodBalance("period-1", undefined, {
        excludeVacationId: "own",
      }),
    ).toEqual({ allottedDays: 3, usedDays: 1, remainingDays: 2 });
    expect(vacationAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "own" },
          periodId: "period-1",
        }),
      }),
    );
  });
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
          status: { code: { in: ["PENDIENTE", "APROBADA"] } },
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
  it("generates calendar grants for a user with no legacy rows only after anniversary", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-06-14T12:00:00Z"));
      userFindUnique.mockResolvedValue({
        hireDate: mxDay("2025-06-15"),
      } as never);
      ruleFindFirst.mockResolvedValue({ days: 12 } as never);
      await ensurePeriodsUpToNow("user-1");
      expect(periodUpsert).not.toHaveBeenCalled();
      vi.setSystemTime(new Date("2026-06-15T06:00:00Z"));
      await ensurePeriodsUpToNow("user-1");
      expect(periodUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ cycleYear: 2026, periodNumber: 1 }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("never generates legacy rows when calendar rows already exist", async () => {
    userFindUnique.mockResolvedValue({
      hireDate: mxDay("2020-06-15"),
    } as never);
    ruleFindFirst.mockResolvedValue({ days: 12 } as never);
    periodFindMany.mockResolvedValue([makeCalendarPeriod({})] as never);
    await ensurePeriodsUpToNow("user-1");
    expect(periodUpsert.mock.calls.length).toBeGreaterThan(0);
    for (const [query] of periodUpsert.mock.calls)
      expect(query.create.cycleYear).toBeTypeOf("number");
  });

  it("fails closed on mixed modes and explicit legacy conversion before any write", async () => {
    userFindUnique.mockResolvedValue({
      hireDate: mxDay("2020-06-15"),
    } as never);
    periodFindMany.mockResolvedValue([
      makePeriod({}),
      makeCalendarPeriod({}),
    ] as never);
    await expect(ensurePeriodsUpToNow("user-1")).rejects.toThrow(/mezclados/);
    periodFindMany.mockResolvedValue([makePeriod({})] as never);
    await expect(ensureCalendarPeriodsForUser("user-1")).rejects.toThrow(
      /heredados/,
    );
    expect(periodUpsert).not.toHaveBeenCalled();
  });
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
    periodFindMany.mockResolvedValue([makePeriod({})] as never);

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
    periodFindMany.mockResolvedValue([makePeriod({})] as never);

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

  it.each([undefined, "p1"])(
    "propagates own exclusion to candidate and explicit funding (%s)",
    async (preferred) => {
      havePeriods([period1, period2]);
      periodFindUnique.mockResolvedValue({ ...period1, ruleDays: 3 } as never);
      vacationAggregate.mockImplementation((async (query: {
        where?: { id?: unknown };
      }) => ({
        _sum: { businessDaysUsed: query.where?.id ? 0 : 2 },
      })) as never);
      expect(
        (
          await resolveVacationPeriod(
            "user-1",
            mxDay("2026-06-10"),
            mxDay("2026-06-12"),
            undefined,
            preferred,
            3,
            { excludeVacationId: "own" },
          )
        ).id,
      ).toBe("p1");
      expect(vacationAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: "own" } }),
        }),
      );
    },
  );

  it("does not refund an old request into a different funding period", async () => {
    const replacement = {
      ...period2,
      accrualStart: mxDay("2026-01-01"),
      ruleDays: 2,
    };
    havePeriods([period1, replacement]);
    periodFindUnique.mockResolvedValue(replacement as never);
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: 2 },
    } as never);
    await expect(
      resolveVacationPeriod(
        "user-1",
        mxDay("2026-06-10"),
        mxDay("2026-06-12"),
        undefined,
        "p2",
        3,
        { excludeVacationId: "own" },
      ),
    ).rejects.toThrow(/saldo suficiente/);
  });

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

  it("skips an earlier expiry without enough balance for the entire range", async () => {
    havePeriods([period2, period1]);
    periodFindUnique.mockImplementation((async ({
      where,
    }: {
      where: { id: string };
    }) => (where.id === "p1" ? period1 : period2)) as never);
    vacationAggregate.mockImplementation((async ({
      where,
    }: {
      where: { periodId: string };
    }) => ({
      _sum: { businessDaysUsed: where.periodId === "p1" ? 11 : 0 },
    })) as never);
    expect(
      (
        await resolveVacationPeriod(
          "user-1",
          mxDay("2027-06-01"),
          mxDay("2027-06-05"),
          undefined,
          undefined,
          5,
        )
      ).id,
    ).toBe("p2");
    await expect(
      resolveVacationPeriod(
        "user-1",
        mxDay("2027-06-01"),
        mxDay("2027-06-05"),
        undefined,
        "p1",
        5,
      ),
    ).rejects.toThrow(/seleccionado.*saldo suficiente/);
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: 11 },
    } as never);
    await expect(
      resolveVacationPeriod(
        "user-1",
        mxDay("2027-06-01"),
        mxDay("2027-06-05"),
        undefined,
        undefined,
        5,
      ),
    ).rejects.toThrow(/Ningún período/);
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

describe("ensureCalendarPeriodsForUser", () => {
  function haveHire(hireDate: Date | null) {
    userFindUnique.mockResolvedValue({ hireDate } as never);
    ruleFindFirst.mockResolvedValue({ days: 12 } as never);
    periodUpsert.mockResolvedValue({} as never);
    periodFindMany.mockResolvedValue([] as never);
  }

  it("creates no grant in the hire year", async () => {
    haveHire(mxDay("2021-06-15"));

    const periods = await ensureCalendarPeriodsForUser("user-1", {
      upToCycleYear: 2021,
    });

    expect(periodUpsert).not.toHaveBeenCalled();
    expect(periods).toEqual([]);
  });

  it("activates tier one on the first completed anniversary", async () => {
    haveHire(mxDay("2021-06-15"));

    await ensureCalendarPeriodsForUser("user-1", { upToCycleYear: 2022 });

    expect(periodUpsert).toHaveBeenCalledTimes(1);
    const args = periodUpsert.mock.calls[0][0];
    expect(args.where).toEqual({
      userId_cycleYear: { userId: "user-1", cycleYear: 2022 },
    });
    // An empty `update` is what protects snapshots and overrides on re-run.
    expect(args.update).toEqual({});
    expect(args.create).toEqual(
      expect.objectContaining({
        userId: "user-1",
        periodNumber: 1,
        cycleYear: 2022,
        ruleDays: 12,
        accrualStart: mxDay("2022-01-01"),
        // June 2022 still observed DST (UTC-5); the helper pins CDMX midnight,
        // not a fixed UTC offset.
        availableFrom: new Date("2022-06-15T05:00:00.000Z"),
        graceEnd: new Date("2024-01-01T05:59:59.999Z"),
      }),
    );
  });

  it("resolves the tier by completed service years, not the calendar year", async () => {
    haveHire(mxDay("2020-06-15"));
    ruleFindFirst.mockImplementation((async (query?: unknown) => {
      const tier = (query as { where: { minYears: { lte: number } } }).where
        .minYears.lte;
      return { days: 10 + tier };
    }) as never);

    await ensureCalendarPeriodsForUser("user-1", { upToCycleYear: 2026 });

    expect(periodUpsert).toHaveBeenCalledTimes(6);
    const creates = periodUpsert.mock.calls.map((call) => call[0].create);
    expect(creates.map((create) => create.periodNumber)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(creates.map((create) => create.ruleDays)).toEqual([
      11, 12, 13, 14, 15, 16,
    ]);
    expect(creates.map((create) => create.cycleYear)).toEqual([
      2021, 2022, 2023, 2024, 2025, 2026,
    ]);
  });

  it("keeps a Jan 1 anniversary at the accrual start and a Dec 31 one at year end", async () => {
    userFindUnique.mockResolvedValue({
      hireDate: mxDay("2021-01-01"),
    } as never);
    ruleFindFirst.mockResolvedValue({ days: 12 } as never);
    periodUpsert.mockResolvedValue({} as never);
    periodFindMany.mockResolvedValue([] as never);

    await ensureCalendarPeriodsForUser("user-1", { upToCycleYear: 2022 });

    const january = periodUpsert.mock.calls[0][0].create;
    expect(january.availableFrom).toEqual(january.accrualStart);

    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({
      hireDate: mxDay("2020-12-31"),
    } as never);
    ruleFindFirst.mockResolvedValue({ days: 12 } as never);
    periodUpsert.mockResolvedValue({} as never);
    periodFindMany.mockResolvedValue([] as never);

    await ensureCalendarPeriodsForUser("user-1", { upToCycleYear: 2021 });

    const december = periodUpsert.mock.calls[0][0].create;
    expect(december.availableFrom).toEqual(mxDay("2021-12-31"));
    expect(december.accrualStart).toEqual(mxDay("2021-01-01"));
  });

  it("returns nothing when the hire date is missing", async () => {
    haveHire(null);

    expect(
      await ensureCalendarPeriodsForUser("user-1", { upToCycleYear: 2026 }),
    ).toEqual([]);
    expect(periodUpsert).not.toHaveBeenCalled();
  });

  it("skips a service year that no accrual rule covers", async () => {
    haveHire(mxDay("2021-06-15"));
    ruleFindFirst.mockResolvedValue(null);

    await ensureCalendarPeriodsForUser("user-1", { upToCycleYear: 2022 });

    expect(periodUpsert).not.toHaveBeenCalled();
  });

  it("uses Feb 28 in common years and Feb 29 in leap years", async () => {
    haveHire(mxDay("2020-02-29"));

    await ensureCalendarPeriodsForUser("user-1", { upToCycleYear: 2024 });

    expect(periodUpsert).toHaveBeenCalledTimes(4);
    expect(periodUpsert.mock.calls[0][0].create.availableFrom).toEqual(
      mxDay("2021-02-28"),
    );
    expect(periodUpsert.mock.calls[3][0].create.availableFrom).toEqual(
      mxDay("2024-02-29"),
    );
  });

  it("fails closed when a legacy row holds the same tier", async () => {
    haveHire(mxDay("2020-06-15"));
    periodFindFirst.mockResolvedValue({
      id: "legacy-1",
      cycleYear: null,
    } as never);

    await expect(
      ensureCalendarPeriodsForUser("user-1", { upToCycleYear: 2021 }),
    ).rejects.toThrow(/otra identidad de ciclo/);
    // The conflict is validated before any row is written.
    expect(periodUpsert).not.toHaveBeenCalled();
  });

  it("treats the same calendar identity as an idempotent no-op", async () => {
    haveHire(mxDay("2020-06-15"));
    periodFindFirst.mockResolvedValue({
      id: "cal-2021",
      cycleYear: 2021,
    } as never);

    await ensureCalendarPeriodsForUser("user-1", { upToCycleYear: 2021 });

    expect(periodUpsert).toHaveBeenCalledTimes(1);
    expect(periodUpsert.mock.calls[0][0].update).toEqual({});
  });
});

describe("isPeriodRequestable with calendar rows", () => {
  const calendar = makeCalendarPeriod({});

  it("rejects the day before activation and accepts the anniversary", () => {
    expect(isPeriodRequestable(calendar, mxDay("2026-06-14"))).toBe(false);
    expect(isPeriodRequestable(calendar, mxDay("2026-06-15"))).toBe(true);
  });

  it("rejects accrual days before activation and accepts Dec 31", () => {
    expect(isPeriodRequestable(calendar, mxDay("2026-01-01"))).toBe(false);
    expect(isPeriodRequestable(calendar, mxDay("2026-12-31"))).toBe(true);
  });

  it("honours the snapshotted grace expiry", () => {
    expect(
      isPeriodRequestable(calendar, new Date("2027-01-01T05:59:59.999Z")),
    ).toBe(true);
    expect(isPeriodRequestable(calendar, mxDay("2027-01-01"))).toBe(false);
  });

  it("accepts Jan 1 when the anniversary falls on New Year", () => {
    const january = makeCalendarPeriod({
      availableFrom: mxDay("2026-01-01"),
    });

    expect(isPeriodRequestable(january, mxDay("2026-01-01"))).toBe(true);
  });
});

describe("getPeriodBalance with the historical ledger", () => {
  function approvedRow(overrides = {}) {
    return {
      id: "hist-1",
      userId: "user-1",
      cycleYear: 2026,
      fundingPeriodId: "cal-2026",
      identityVerified: true,
      reviewStatus: "APPROVED",
      sourceDigest: "a".repeat(64),
      sourceSheet: "Synthetic",
      sourceRow: 1,
      sourceEntitledDays: 12,
      sourceTakenDays: 5,
      sourceRemainingDays: 7,
      allocatedToDatedDays: 0,
      ...overrides,
    };
  }

  function haveLedger() {
    periodFindUnique.mockResolvedValue(
      makeCalendarPeriod({ id: "cal-2026" }) as never,
    );
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: 2 },
    } as never);
    historicalFindMany.mockResolvedValue([approvedRow()] as never);
    vacationFindMany.mockResolvedValue([
      {
        id: "r1",
        userId: "user-1",
        periodId: "cal-2026",
        active: true,
        status: { code: "PENDIENTE" },
        businessDaysUsed: 2,
      },
    ] as never);
  }

  it("uses own-excluded historical balance during candidate selection", async () => {
    haveLedger();
    userFindUnique.mockResolvedValue({
      hireDate: mxDay("2020-06-15"),
    } as never);
    ruleFindFirst.mockResolvedValue({ days: 14 } as never);
    periodFindMany.mockResolvedValue([makeCalendarPeriod({})] as never);
    vacationFindMany.mockImplementation((async (query: {
      where?: { id?: unknown };
    }) =>
      query.where?.id
        ? []
        : [
            {
              id: "r1",
              userId: "user-1",
              periodId: "cal-2026",
              active: true,
              status: { code: "PENDIENTE" },
              businessDaysUsed: 2,
            },
          ]) as never);
    expect(
      (
        await resolveVacationPeriod(
          "user-1",
          mxDay("2026-07-01"),
          mxDay("2026-07-10"),
          undefined,
          undefined,
          8,
          { excludeVacationId: "r1" },
        )
      ).id,
    ).toBe("cal-2026");
    await expect(
      resolveVacationPeriod(
        "user-1",
        mxDay("2026-07-01"),
        mxDay("2026-07-10"),
        undefined,
        undefined,
        8,
      ),
    ).rejects.toThrow(/saldo suficiente/);
  });

  it("excludes the dated reservation without excluding historical consumption", async () => {
    haveLedger();
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: 0 },
    } as never);
    vacationFindMany.mockResolvedValue([] as never);
    expect(
      await getPeriodBalance("cal-2026", undefined, {
        excludeVacationId: "r1",
      }),
    ).toEqual({ allottedDays: 14, usedDays: 5, remainingDays: 9 });
    expect(vacationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodId: "cal-2026", active: true, id: { not: "r1" } },
      }),
    );
    expect(historicalFindMany).toHaveBeenCalledWith({
      where: { fundingPeriodId: "cal-2026" },
    });
  });

  it("adds approved aggregate consumption to dated reservations", async () => {
    haveLedger();

    await expect(getPeriodBalance("cal-2026")).resolves.toEqual({
      allottedDays: 14,
      usedDays: 7,
      remainingDays: 7,
    });
  });

  it("uses the admin override as the allotment with history present", async () => {
    haveLedger();
    periodFindUnique.mockResolvedValue(
      makeCalendarPeriod({ id: "cal-2026", overrideDays: 16 }) as never,
    );

    await expect(getPeriodBalance("cal-2026")).resolves.toEqual({
      allottedDays: 16,
      usedDays: 7,
      remainingDays: 9,
    });
  });

  it("rejects history plus reservations above the grant", async () => {
    haveLedger();
    historicalFindMany.mockResolvedValue([
      approvedRow({
        sourceTakenDays: 10,
        sourceRemainingDays: 2,
      }),
    ] as never);
    vacationFindMany.mockResolvedValue([
      {
        id: "r1",
        userId: "user-1",
        periodId: "cal-2026",
        active: true,
        status: { code: "APROBADA" },
        businessDaysUsed: 5,
      },
    ] as never);

    await expect(getPeriodBalance("cal-2026")).rejects.toThrow();
  });

  it("ignores pending ledger rows instead of debiting them", async () => {
    haveLedger();
    historicalFindMany.mockResolvedValue([
      approvedRow({
        reviewStatus: "PENDING",
        fundingPeriodId: null,
      }),
    ] as never);
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: null },
    } as never);
    vacationFindMany.mockResolvedValue([] as never);

    await expect(getPeriodBalance("cal-2026")).resolves.toEqual({
      allottedDays: 14,
      usedDays: 0,
      remainingDays: 14,
    });
  });

  it("leaves legacy arithmetic untouched when the ledger is empty", async () => {
    periodFindUnique.mockResolvedValue(makePeriod({ ruleDays: 12 }) as never);
    vacationAggregate.mockResolvedValue({
      _sum: { businessDaysUsed: 5 },
    } as never);

    await expect(getPeriodBalance("period-1")).resolves.toEqual({
      allottedDays: 12,
      usedDays: 5,
      remainingDays: 7,
    });
    // No reservation detail is read on the legacy path.
    expect(vacationFindMany).not.toHaveBeenCalled();
  });
});

describe("resolveVacationPeriod with calendar rows", () => {
  const cal2025 = makeCalendarPeriod({
    id: "cal-2025",
    periodNumber: 5,
    cycleYear: 2025,
    availableFrom: mxDay("2025-06-15"),
    accrualStart: mxDay("2025-01-01"),
    accrualEnd: mxDay("2025-12-31"),
    graceEnd: new Date("2027-01-01T05:59:59.999Z"),
    ruleDays: 12,
  });
  const cal2026 = makeCalendarPeriod({
    id: "cal-2026",
    periodNumber: 6,
    cycleYear: 2026,
    availableFrom: mxDay("2026-06-15"),
    accrualStart: mxDay("2026-01-01"),
    accrualEnd: mxDay("2026-12-31"),
    graceEnd: new Date("2028-01-01T05:59:59.999Z"),
    ruleDays: 14,
  });

  function haveCalendarPeriods() {
    userFindUnique.mockResolvedValue({
      hireDate: mxDay("2020-06-15"),
    } as never);
    ruleFindFirst.mockResolvedValue({ days: 12 } as never);
    periodUpsert.mockResolvedValue({} as never);
    periodFindMany.mockResolvedValue([cal2025, cal2026] as never);
  }

  it("funds from the still-valid prior grant before the anniversary", async () => {
    haveCalendarPeriods();

    const resolved = await resolveVacationPeriod(
      "user-1",
      mxDay("2026-05-10"),
      mxDay("2026-05-12"),
    );

    // The 2026 grant is unearned until Jun 15; the 2025 grant is still valid.
    expect(resolved.id).toBe("cal-2025");
  });

  it("lets the explicitly picked activated cycle win", async () => {
    haveCalendarPeriods();

    const resolved = await resolveVacationPeriod(
      "user-1",
      mxDay("2026-07-01"),
      mxDay("2026-07-03"),
      undefined,
      "cal-2026",
    );

    expect(resolved.id).toBe("cal-2026");
  });

  it("prefers the oldest grant when nothing was picked", async () => {
    haveCalendarPeriods();

    const resolved = await resolveVacationPeriod(
      "user-1",
      mxDay("2026-07-01"),
      mxDay("2026-07-03"),
    );

    expect(resolved.id).toBe("cal-2025");
  });

  it("rejects the picked cycle before its anniversary", async () => {
    haveCalendarPeriods();

    await expect(
      resolveVacationPeriod(
        "user-1",
        mxDay("2026-05-10"),
        mxDay("2026-05-12"),
        undefined,
        "cal-2026",
      ),
    ).rejects.toThrow(/fuera de la vigencia del período 6/);
  });

  it("rejects an imported future grant until it is earned, even for dates after activation", async () => {
    haveCalendarPeriods();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-06-14T12:00:00Z"));
      await expect(
        resolveVacationPeriod(
          "user-1",
          mxDay("2026-07-01"),
          mxDay("2026-07-03"),
          undefined,
          "cal-2026",
        ),
      ).rejects.toThrow(/fuera de la vigencia/);
      expect(
        (
          await resolveVacationPeriod(
            "user-1",
            mxDay("2026-07-01"),
            mxDay("2026-07-03"),
          )
        ).id,
      ).toBe("cal-2025");
      vi.setSystemTime(new Date("2026-06-15T06:00:00Z"));
      expect(
        (
          await resolveVacationPeriod(
            "user-1",
            mxDay("2026-07-01"),
            mxDay("2026-07-03"),
            undefined,
            "cal-2026",
          )
        ).id,
      ).toBe("cal-2026");
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a range no single cycle can fund instead of splitting", async () => {
    haveCalendarPeriods();

    await expect(
      resolveVacationPeriod("user-1", mxDay("2026-01-10"), mxDay("2027-06-01")),
    ).rejects.toThrow(/abarca dos períodos/);
  });
});

describe("recomputePeriodsForNewHireDate with calendar rows", () => {
  it("keeps each period's original grace duration when global settings change", async () => {
    settingFindUnique.mockResolvedValue({ graceWindowMonths: 24 } as never);
    periodFindMany.mockResolvedValue([
      {
        ...makeCalendarPeriod({
          graceEnd: new Date("2028-01-01T05:59:59.999Z"),
        }),
        vacations: [],
        historicalConsumption: [],
      },
    ] as never);
    await recomputePeriodsForNewHireDate("user-1", mxDay("2020-03-10"));
    expect(periodUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          graceEnd: new Date("2028-01-01T05:59:59.999Z"),
        }),
      }),
    );
  });

  it("fails closed when a hire-year correction would change the calendar tier identity", async () => {
    periodFindMany.mockResolvedValue([
      { ...makeCalendarPeriod({}), vacations: [], historicalConsumption: [] },
    ] as never);
    await expect(
      recomputePeriodsForNewHireDate("user-1", mxDay("2019-03-10")),
    ).rejects.toThrow(/identidad/);
    expect(periodUpdate).not.toHaveBeenCalled();
  });
  it("recomputes Jan 1 and anniversary windows while keeping the override", async () => {
    periodFindMany.mockResolvedValue([
      {
        ...makeCalendarPeriod({
          id: "cal-2026",
          overrideDays: 20,
          graceEnd: new Date("2028-01-01T05:59:59.999Z"),
        }),
        vacations: [],
        historicalConsumption: [],
      },
    ] as never);
    periodUpdate.mockResolvedValue({} as never);

    await recomputePeriodsForNewHireDate("user-1", mxDay("2020-03-10"));

    expect(periodUpdate).toHaveBeenCalledTimes(1);
    // Exact match: identity, snapshots and overrides are never rewritten.
    expect(periodUpdate.mock.calls[0][0].data).toEqual({
      accrualStart: mxDay("2026-01-01"),
      accrualEnd: new Date("2027-01-01T05:59:59.999Z"),
      availableFrom: mxDay("2026-03-10"),
      graceEnd: new Date("2028-01-01T05:59:59.999Z"),
    });
  });

  it("refuses to delete a period with historical consumption", async () => {
    periodFindMany.mockResolvedValue([
      {
        ...makePeriod({ id: "p9", periodNumber: 9 }),
        vacations: [],
        historicalConsumption: [{ id: "hist-1" }],
      },
    ] as never);

    // A hire date of today leaves only period 1, so period 9 would vanish.
    await expect(
      recomputePeriodsForNewHireDate("user-1", new Date()),
    ).rejects.toThrow(/consumo histórico/);
    expect(periodDelete).not.toHaveBeenCalled();
    expect(periodUpdate).not.toHaveBeenCalled();
  });

  it("recomputes leap-day hires with the approved anniversary policy", async () => {
    periodFindMany.mockResolvedValue([
      {
        ...makeCalendarPeriod({
          id: "cal-2024",
          periodNumber: 4,
          cycleYear: 2024,
        }),
        vacations: [],
        historicalConsumption: [],
      },
    ] as never);

    await recomputePeriodsForNewHireDate("user-1", mxDay("2020-02-29"));
    expect(periodUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ availableFrom: mxDay("2024-02-29") }),
      }),
    );
  });

  it("refuses a hire date that moves activation past a funded vacation", async () => {
    periodFindMany.mockResolvedValue([
      {
        ...makeCalendarPeriod({}),
        vacations: [
          {
            id: "v1",
            startDate: mxDay("2026-06-20"),
            endDate: mxDay("2026-06-22"),
            reason: null,
          },
        ],
        historicalConsumption: [],
      },
    ] as never);

    await expect(
      recomputePeriodsForNewHireDate("user-1", mxDay("2020-09-10")),
    ).rejects.toThrow(/fuera del período del ciclo 2026/);
    expect(periodUpdate).not.toHaveBeenCalled();
  });

  it("rejects an invalid hire date before reading anything", async () => {
    await expect(
      recomputePeriodsForNewHireDate("user-1", new Date("invalid")),
    ).rejects.toThrow(/no es válida/);
    expect(periodFindMany).not.toHaveBeenCalled();
  });
});
