import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/utils/availability", () => ({ getHolidayDatesForYear }));
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
  requirePermission.mockResolvedValue({
    id: "employee-1",
    isSuperuser: false,
    permissions: new Set(),
  });
  prismaMock.vacationStatus.findFirst.mockResolvedValue({ id: 1 });
  prismaMock.vacationStatus.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  getHolidayDatesForYear.mockResolvedValue(new Set());
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
  prismaMock.user.findUnique.mockResolvedValue({ name: "Employee" });
});

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
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.vacation.create).not.toHaveBeenCalled();
  });

  it("rejects a Saturday when it is an active holiday", async () => {
    getHolidayDatesForYear.mockResolvedValue(new Set(["2026-06-13"]));
    const result = await createVacation({
      startDate: dateInput("2026-06-13"),
      endDate: dateInput("2026-06-13"),
    });

    expect(result.success).toBe(false);
    expect(prismaMock.vacation.create).not.toHaveBeenCalled();
  });

  it("loads both years' active holidays for a request crossing New Year", async () => {
    getHolidayDatesForYear.mockImplementation(
      async (year: number) =>
        new Set(year === 2026 ? ["2026-12-31"] : ["2027-01-01"]),
    );

    const result = await createVacation({
      startDate: dateInput("2026-12-31"),
      endDate: dateInput("2027-01-02"),
    });

    expect(getHolidayDatesForYear.mock.calls.map(([year]) => year)).toEqual([
      2026, 2027,
    ]);
    expect(result.success).toBe(true);
    expect(prismaMock.vacation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ businessDaysUsed: 1 }),
    });
  });
});
