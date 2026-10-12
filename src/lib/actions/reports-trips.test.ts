import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, requirePermission, scope } = vi.hoisted(() => ({
  db: {
    role: { findFirst: vi.fn() },
    user: { findMany: vi.fn() },
    holiday: { findMany: vi.fn() },
    vacation: { findMany: vi.fn() },
    vehicleTrip: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    incident: { count: vi.fn() },
    assignment: { findMany: vi.fn(), count: vi.fn() },
  },
  requirePermission: vi.fn(),
  scope: { clientIds: ["c1"] as string[] | null },
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: db }));
vi.mock("@/lib/auth/auth", () => ({ requirePermission }));
vi.mock("@/lib/auth/report-scope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/report-scope")>()),
  getReportScope: async () => scope,
}));

import {
  getDailyTripComplianceReport,
  getFSRPerformanceData,
  getReportSummary,
  getVehicleTripsByFSRData,
  getVehicleTripTrendData,
} from "./reports";

const users = [
  { id: "u1", name: "FSR One", email: "one@example.test" },
  { id: "u2", name: "FSR Two", email: "two@example.test" },
  { id: "u3", name: "FSR Three", email: "three@example.test" },
];

function trip(day: string, fsrId = "u1", kmDriven: number | null = 10) {
  return {
    fsrId,
    fsr: { id: fsrId, name: users.find((user) => user.id === fsrId)?.name },
    startedAt: new Date(`${day}T18:00:00Z`),
    startCapturedAt: null as Date | null,
    endedAt: null as Date | null,
    endCapturedAt: null as Date | null,
    kmDriven,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T18:00:00Z"));
  scope.clientIds = ["c1"];
  requirePermission.mockResolvedValue({ id: "admin1" });
  db.role.findFirst.mockResolvedValue({ id: 1 });
  db.user.findMany.mockResolvedValue(users);
  db.holiday.findMany.mockResolvedValue([]);
  db.vacation.findMany.mockResolvedValue([]);
  db.vehicleTrip.findMany.mockResolvedValue([]);
  db.vehicleTrip.count.mockResolvedValue(4);
  db.vehicleTrip.aggregate.mockResolvedValue({ _sum: { kmDriven: 85 } });
  db.incident.count.mockResolvedValue(0);
  db.assignment.count.mockResolvedValue(0);
  db.assignment.findMany.mockResolvedValue([]);
});

afterEach(() => vi.useRealTimers());

describe("daily trip eligibility", () => {
  it("counts only eligible days, preserves exceptional trips, and averages only eligible FSRs", async () => {
    db.holiday.findMany.mockResolvedValue([
      { month: 10, day: 9, nthMonday: null, isRecurring: true, year: null },
    ]);
    db.vacation.findMany.mockResolvedValue([
      {
        userId: "u1",
        startDate: new Date("2026-10-08T06:00:00Z"),
        endDate: new Date("2026-10-09T05:59:59Z"),
      },
      {
        userId: "u2",
        startDate: new Date("2026-10-08T06:00:00Z"),
        endDate: new Date("2026-10-15T05:59:59Z"),
      },
    ]);
    db.vehicleTrip.findMany.mockResolvedValue([
      trip("2026-10-08"),
      trip("2026-10-09"),
      trip("2026-10-10"),
      trip("2026-10-11"),
      trip("2026-10-12"),
      trip("2026-10-13"),
      trip("2026-10-10", "u3"),
    ]);
    const report = await getDailyTripComplianceReport({
      startDate: "2026-10-08",
      endDate: "2026-10-14",
    });
    const [one, two, three] = report.rows;
    expect(report.days).toHaveLength(7);
    expect(one).toMatchObject({
      totalDays: 2,
      daysReported: 2,
      daysMissed: 0,
      daysNotApplicable: 5,
      complianceRatePct: 100,
    });
    expect(one.byDay["2026-10-08"]).toMatchObject({
      applicable: false,
      reason: "vacation",
      reported: true,
      tripCount: 1,
      kmDriven: 10,
    });
    expect(one.byDay["2026-10-09"]).toMatchObject({
      applicable: false,
      reason: "holiday",
      reported: true,
    });
    expect(one.byDay["2026-10-10"]).toMatchObject({
      applicable: true,
      reported: true,
    });
    expect(one.byDay["2026-10-11"]).toMatchObject({
      applicable: false,
      reason: "sunday",
      reported: true,
    });
    expect(one.byDay["2026-10-13"]).toMatchObject({
      applicable: false,
      reason: "future",
      reported: true,
    });
    expect(two).toMatchObject({
      totalDays: 0,
      daysReported: 0,
      daysMissed: 0,
      daysNotApplicable: 7,
      complianceRatePct: null,
    });
    expect(three).toMatchObject({
      totalDays: 3,
      daysReported: 1,
      daysMissed: 2,
      complianceRatePct: 33,
    });
    expect(report.summary).toEqual({
      totalFsrs: 3,
      fullyCompliant: 1,
      missedToday: 1,
      averageComplianceRate: 67,
    });
    expect(db.holiday.findMany).toHaveBeenCalledOnce();
    expect(db.holiday.findMany).toHaveBeenCalledWith({
      where: { active: true },
    });
    expect(db.vacation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { in: ["u1", "u2", "u3"] },
          active: true,
          status: { code: "APROBADA" },
        }),
      }),
    );
  });

  it("shows N/A for a future-only range instead of counting misses or full compliance", async () => {
    const report = await getDailyTripComplianceReport({
      startDate: "2026-10-13",
      endDate: "2026-10-15",
    });
    expect(
      report.rows.every(
        (row) =>
          row.totalDays === 0 &&
          row.daysMissed === 0 &&
          row.complianceRatePct === null,
      ),
    ).toBe(true);
    expect(report.summary).toEqual({
      totalFsrs: 3,
      fullyCompliant: 0,
      missedToday: 0,
      averageComplianceRate: null,
    });
  });

  it("Sunday today is non-applicable even with an actual trip", async () => {
    vi.setSystemTime(new Date("2026-10-11T18:00:00Z"));
    db.vehicleTrip.findMany.mockResolvedValue([trip("2026-10-11")]);
    const report = await getDailyTripComplianceReport({
      startDate: "2026-10-11",
      endDate: "2026-10-11",
    });
    expect(report.rows[0]).toMatchObject({
      reportedToday: true,
      daysReported: 0,
      totalDays: 0,
      complianceRatePct: null,
    });
    expect(report.summary.missedToday).toBe(0);
  });

  it("supports recurring nth-Monday holidays and one-time years across calendar boundaries", async () => {
    db.holiday.findMany.mockResolvedValue([
      { month: 1, day: 1, nthMonday: null, isRecurring: true, year: null },
      { month: 12, day: 31, nthMonday: null, isRecurring: false, year: 2024 },
      { month: 1, day: null, nthMonday: 1, isRecurring: true, year: null },
    ]);
    const report = await getDailyTripComplianceReport({
      startDate: "2025-12-31",
      endDate: "2026-01-05",
    });
    expect(report.rows[0].byDay["2025-12-31"]).toMatchObject({
      applicable: true,
    });
    expect(report.rows[0].byDay["2026-01-01"]).toMatchObject({
      applicable: false,
      reason: "holiday",
    });
    expect(report.rows[0].byDay["2026-01-05"]).toMatchObject({
      applicable: false,
      reason: "holiday",
    });
    expect(report.rows[0]).toMatchObject({
      totalDays: 3,
      daysNotApplicable: 3,
    });
  });

  it("keeps Saturday eligible and excludes only the approved vacation interval for its FSR", async () => {
    db.vacation.findMany.mockResolvedValue([
      {
        userId: "u1",
        startDate: new Date("2026-10-10T06:00:00Z"),
        endDate: new Date("2026-10-11T05:59:59.999Z"),
      },
    ]);
    const report = await getDailyTripComplianceReport({
      startDate: "2026-10-09",
      endDate: "2026-10-12",
    });
    expect(report.rows[0]).toMatchObject({
      totalDays: 2,
      daysNotApplicable: 2,
    });
    expect(report.rows[0].byDay["2026-10-09"]).toMatchObject({
      applicable: true,
    });
    expect(report.rows[0].byDay["2026-10-10"]).toMatchObject({
      applicable: false,
      reason: "vacation",
    });
    expect(report.rows[0].byDay["2026-10-12"]).toMatchObject({
      applicable: true,
    });
    expect(report.rows[1].byDay["2026-10-10"]).toMatchObject({
      applicable: true,
    });
  });

  it("groups by CDMX capture day and uses received-time fallback for legacy trips", async () => {
    db.vehicleTrip.findMany.mockResolvedValue([
      {
        ...trip("2026-10-12"),
        startCapturedAt: new Date("2026-10-11T05:59:59.999Z"),
      },
      trip("2026-10-12", "u1", null),
    ]);
    const report = await getDailyTripComplianceReport({
      startDate: "2026-10-10",
      endDate: "2026-10-12",
    });
    expect(report.rows[0]).toMatchObject({
      totalDays: 2,
      daysReported: 2,
      complianceRatePct: 100,
      lastTripAt: "2026-10-12T18:00:00.000Z",
    });
    expect(report.rows[0].byDay["2026-10-10"]).toMatchObject({
      reported: true,
      tripCount: 1,
      kmDriven: 10,
    });
    expect(report.rows[0].byDay["2026-10-11"]).toMatchObject({
      reported: false,
    });
    expect(report.rows[0].byDay["2026-10-12"]).toMatchObject({
      reported: true,
      kmDriven: 0,
    });
  });

  it("does not disclose vacation reasons and applies the scoped FSR set", async () => {
    await getDailyTripComplianceReport();
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientAssignments: {
            some: { active: true, clientId: { in: ["c1"] } },
          },
        }),
      }),
    );
    expect(db.vacation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { userId: true, startDate: true, endDate: true },
      }),
    );
  });

  it.each(["no users", "no role"])(
    "returns a nullable empty summary with %s",
    async (kind) => {
      if (kind === "no users") db.user.findMany.mockResolvedValue([]);
      else db.role.findFirst.mockResolvedValue(null);
      const report = await getDailyTripComplianceReport();
      expect(report.rows).toEqual([]);
      expect(report.summary).toEqual({
        totalFsrs: 0,
        fullyCompliant: 0,
        missedToday: 0,
        averageComplianceRate: null,
      });
      expect(db.vehicleTrip.findMany).not.toHaveBeenCalled();
      expect(db.vacation.findMany).not.toHaveBeenCalled();
      expect(db.holiday.findMany).not.toHaveBeenCalled();
    },
  );
});

describe("capture-time trip reports", () => {
  const range = { startDate: "2026-10-10", endDate: "2026-10-12" };
  const effectiveRange = {
    OR: [
      {
        startCapturedAt: {
          gte: new Date("2026-10-10T06:00:00Z"),
          lte: new Date("2026-10-13T05:59:59.999Z"),
        },
      },
      {
        startCapturedAt: null,
        startedAt: {
          gte: new Date("2026-10-10T06:00:00Z"),
          lte: new Date("2026-10-13T05:59:59.999Z"),
        },
      },
    ],
  };

  it("calculates effective durations with legacy fallback and excludes incomplete/inverted endpoints from averages", async () => {
    const captured = {
      ...trip("2026-10-10"),
      startCapturedAt: new Date("2026-10-10T16:00:00Z"),
      endCapturedAt: new Date("2026-10-10T18:00:00Z"),
      endedAt: new Date("2026-10-10T22:00:00Z"),
    };
    const legacy = {
      ...trip("2026-10-10"),
      endedAt: new Date("2026-10-10T19:00:00Z"),
    };
    const mixed = {
      ...trip("2026-10-10"),
      startCapturedAt: new Date("2026-10-10T17:00:00Z"),
      endedAt: new Date("2026-10-10T20:00:00Z"),
    };
    const zero = {
      ...trip("2026-10-10"),
      endCapturedAt: new Date("2026-10-10T18:00:00Z"),
    };
    const inverted = {
      ...trip("2026-10-10"),
      endCapturedAt: new Date("2026-10-10T17:00:00Z"),
      endedAt: new Date("2026-10-10T20:00:00Z"),
    };
    db.vehicleTrip.findMany.mockResolvedValue([
      captured,
      legacy,
      mixed,
      zero,
      inverted,
      trip("2026-10-10"),
    ]);
    expect(await getVehicleTripTrendData(range)).toEqual([
      { date: "2026-10-10", trips: 6, totalKm: 60, totalDurationHours: 6 },
    ]);
    expect(await getVehicleTripsByFSRData(range)).toEqual([
      {
        fsrId: "u1",
        fsrName: "FSR One",
        trips: 6,
        totalKm: 60,
        averageKm: 10,
        averageDurationHours: 1.5,
      },
    ]);
  });

  it("uses capture dates without changing trip or kilometer counts", async () => {
    db.vehicleTrip.findMany.mockResolvedValue([
      {
        ...trip("2026-10-13"),
        startCapturedAt: new Date("2026-10-11T05:59:59.999Z"),
      },
      trip("2026-10-10", "u1", 20),
      trip("2026-10-12", "u1", null),
    ]);
    expect(await getVehicleTripTrendData(range)).toEqual([
      { date: "2026-10-10", trips: 2, totalKm: 30, totalDurationHours: null },
      { date: "2026-10-12", trips: 1, totalKm: 0, totalDurationHours: null },
    ]);
    const where = db.vehicleTrip.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual(effectiveRange);
    expect(where.AND[1].OR).toHaveLength(2);
    expect(JSON.stringify(where.AND[1])).toContain("c1");
  });

  it("uses the same range and scope for per-FSR totals and executive summary", async () => {
    db.vehicleTrip.findMany.mockResolvedValue([
      trip("2026-10-10", "u1", 20),
      trip("2026-10-11", "u1", 30),
      trip("2026-10-12", "u2", 35),
    ]);
    expect(await getVehicleTripsByFSRData(range)).toEqual([
      {
        fsrId: "u1",
        fsrName: "FSR One",
        trips: 2,
        totalKm: 50,
        averageKm: 25,
        averageDurationHours: null,
      },
      {
        fsrId: "u2",
        fsrName: "FSR Two",
        trips: 1,
        totalKm: 35,
        averageKm: 35,
        averageDurationHours: null,
      },
    ]);
    expect(await getReportSummary(range)).toMatchObject({
      totalTrips: 4,
      totalKmDriven: 85,
    });
    for (const call of [
      db.vehicleTrip.findMany.mock.calls[0],
      db.vehicleTrip.count.mock.calls[0],
      db.vehicleTrip.aggregate.mock.calls[0],
    ]) {
      expect(call[0].where.AND[0]).toEqual(effectiveRange);
      expect(JSON.stringify(call[0].where.AND[1])).toContain("c1");
    }
  });

  it("uses effective start range for performance and compliance fan-out without overriding FSR scope", async () => {
    await getFSRPerformanceData(range);
    for (const [args] of db.vehicleTrip.findMany.mock.calls)
      expect(args.where).toMatchObject({
        active: true,
        ...effectiveRange,
        fsrId: expect.any(String),
      });
    db.vehicleTrip.findMany.mockClear();
    await getDailyTripComplianceReport(range);
    expect(db.vehicleTrip.findMany.mock.calls[0][0].where).toEqual({
      active: true,
      fsrId: { in: ["u1", "u2", "u3"] },
      ...effectiveRange,
    });
  });
});
