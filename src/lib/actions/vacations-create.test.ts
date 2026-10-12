import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  requirePermission,
  getHolidayDatesForYear,
  resolveVacationPeriod,
  getPeriodBalance,
  notifyVacationRequested,
} = vi.hoisted(() => ({
  prismaMock: {
    vacationStatus: { findFirst: vi.fn(), findMany: vi.fn() },
    vacation: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    holiday: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  requirePermission: vi.fn(),
  getHolidayDatesForYear: vi.fn(),
  resolveVacationPeriod: vi.fn(),
  getPeriodBalance: vi.fn(),
  notifyVacationRequested: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({ requirePermission }));
vi.mock("@/lib/utils/availability", async (original) => ({
  ...(await original<typeof import("@/lib/utils/availability")>()),
  getHolidayDatesForYear,
}));
vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction: (run: (tx: unknown) => unknown) =>
    prismaMock.$transaction(() => run(prismaMock)),
}));
vi.mock("@/lib/services/vacation-periods", () => ({
  resolveVacationPeriod,
  getPeriodBalance,
}));
vi.mock("@/lib/notifications", () => ({ notifyVacationRequested }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createVacation } from "./vacations";

// Date inputs are UTC midnight; the action maps them to CDMX day boundaries.
function dateInput(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  requirePermission.mockResolvedValue({
    id: "employee-1",
    isSuperuser: false,
    permissions: new Set(),
  });
  prismaMock.vacationStatus.findFirst.mockResolvedValue({ id: 1 });
  prismaMock.vacationStatus.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  getHolidayDatesForYear.mockResolvedValue(new Set());
  prismaMock.holiday.findMany.mockResolvedValue([]);
  resolveVacationPeriod.mockResolvedValue({ id: "period-1", periodNumber: 1 });
  getPeriodBalance.mockResolvedValue({ remainingDays: 5 });
  prismaMock.vacation.findFirst.mockResolvedValue(null);
  prismaMock.vacation.create.mockImplementation(async ({ data }) => ({
    id: "vacation-1",
    ...data,
  }));
  prismaMock.$transaction.mockImplementation(async (callback) =>
    callback(prismaMock),
  );
  prismaMock.user.findUnique.mockResolvedValue({
    name: "Employee",
    active: true,
  });
});
afterEach(() => vi.useRealTimers());

describe("createVacation day charges", () => {
  it("creates a one-day Saturday request with one day charged", async () => {
    const result = await createVacation({
      startDate: dateInput("2026-06-13"),
      endDate: dateInput("2026-06-13"),
    });

    expect(result.success).toBe(true);
    expect(prismaMock.vacation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessDaysUsed: 1,
        startDate: new Date("2026-06-13T06:00:00.000Z"),
        endDate: new Date("2026-06-14T05:59:59.999Z"),
        chargedDates: ["2026-06-13"],
        reason: null,
      }),
    });
  });

  it("returns a business-rule rejection for a Sunday without inserting", async () => {
    const result = await createVacation({
      startDate: dateInput("2026-06-14"),
      endDate: dateInput("2026-06-14"),
    });

    expect(result).toEqual({
      success: false,
      error:
        "El rango solicitado no incluye días de vacaciones computables (solo domingos o días festivos).",
    });
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.vacation.create).not.toHaveBeenCalled();
  });

  it("rejects a Saturday when it is an active holiday", async () => {
    prismaMock.holiday.findMany.mockResolvedValue([
      { month: 6, day: 13, nthMonday: null, isRecurring: true, year: null },
    ]);
    const result = await createVacation({
      startDate: dateInput("2026-06-13"),
      endDate: dateInput("2026-06-13"),
    });

    expect(result.success).toBe(false);
    expect(prismaMock.vacation.create).not.toHaveBeenCalled();
  });

  it("loads both years' active holidays for a request crossing New Year", async () => {
    prismaMock.holiday.findMany.mockResolvedValue([
      { month: 12, day: 31, nthMonday: null, isRecurring: true, year: null },
      { month: 1, day: 1, nthMonday: null, isRecurring: true, year: null },
    ]);

    const result = await createVacation({
      startDate: dateInput("2026-12-31"),
      endDate: dateInput("2027-01-02"),
    });

    expect(prismaMock.holiday.findMany).toHaveBeenCalledWith({
      where: { active: true },
    });
    expect(result.success).toBe(true);
    expect(prismaMock.vacation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ businessDaysUsed: 1 }),
    });
  });

  it("rejects non-admin retroactive requests before opening the transaction", async () => {
    const result = await createVacation({
      startDate: dateInput("2026-05-30"),
      endDate: dateInput("2026-05-30"),
    });
    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/retroactivas/),
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("requires an admin reason for retroactive creation and stamps the actor", async () => {
    requirePermission.mockResolvedValue({ id: "admin", isSuperuser: true });
    const input = {
      startDate: dateInput("2026-05-30"),
      endDate: dateInput("2026-05-30"),
    };
    expect(await createVacation(input)).toMatchObject({
      success: false,
      error: expect.stringMatching(/motivo/),
    });
    expect(
      (await createVacation({ ...input, reason: "Historical correction" }))
        .success,
    ).toBe(true);
    expect(prismaMock.vacation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdById: "admin",
        businessDaysUsed: 1,
        reason: "Historical correction",
        chargedDates: ["2026-05-30"],
      }),
    });
    expect(resolveVacationPeriod).toHaveBeenLastCalledWith(
      "admin",
      expect.any(Date),
      expect.any(Date),
      prismaMock,
      undefined,
      1,
    );
  });

  it("rejects insufficient balance and overlapping reservations atomically", async () => {
    const input = {
      startDate: dateInput("2026-06-13"),
      endDate: dateInput("2026-06-13"),
    };
    getPeriodBalance.mockResolvedValue({ remainingDays: 0 });
    expect((await createVacation(input)).success).toBe(false);
    getPeriodBalance.mockResolvedValue({ remainingDays: 5 });
    prismaMock.vacation.findFirst.mockResolvedValue({ id: "overlap" });
    expect((await createVacation(input)).success).toBe(false);
    expect(prismaMock.vacation.create).not.toHaveBeenCalled();
    expect(notifyVacationRequested).not.toHaveBeenCalled();
    expect(prismaMock.vacation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { code: { in: ["PENDIENTE", "APROBADA"] } },
      }),
      select: { id: true },
    });
  });
});
