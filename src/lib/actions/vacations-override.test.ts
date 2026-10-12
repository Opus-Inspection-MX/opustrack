import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermission, getPeriodBalance, revalidatePath } =
  vi.hoisted(() => ({
    prismaMock: {
      vacationPeriod: { findUnique: vi.fn(), update: vi.fn() },
    },
    requirePermission: vi.fn(),
    getPeriodBalance: vi.fn(),
    revalidatePath: vi.fn(),
  }));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction: (run: (tx: unknown) => unknown) => run(prismaMock),
}));
vi.mock("@/lib/auth/auth", () => ({ requirePermission }));
vi.mock("@/lib/services/vacation-periods", () => ({
  allottedDaysFor: (period: {
    overrideDays: number | null;
    ruleDays: number;
  }) => period.overrideDays ?? period.ruleDays,
  ensurePeriodsUpToNow: vi.fn(),
  getPeriodBalance,
  resolveVacationPeriod: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { updatePeriodOverride } from "./vacations";

const period = {
  id: "period-1",
  ruleDays: 12,
  overrideDays: null as number | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ id: "admin-1" });
  prismaMock.vacationPeriod.findUnique.mockResolvedValue({ ...period });
  prismaMock.vacationPeriod.update.mockImplementation(
    async ({ data }: { data: { overrideDays: number | null } }) => ({
      id: "period-1",
      ruleDays: 12,
      overrideDays: data.overrideDays,
    }),
  );
});

describe("updatePeriodOverride floor", () => {
  it("blocks an override below consumed plus reserved days", async () => {
    // usedDays already includes historical aggregate consumption: the guard
    // sees one number covering both ledgers.
    getPeriodBalance.mockResolvedValue({
      allottedDays: 12,
      usedDays: 9,
      remainingDays: 3,
    });

    const result = await updatePeriodOverride("period-1", 8);

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/consumidos o reservados/),
    });
    expect(prismaMock.vacationPeriod.update).not.toHaveBeenCalled();
  });

  it("allows an override exactly at consumed plus reserved days", async () => {
    getPeriodBalance.mockResolvedValue({
      allottedDays: 12,
      usedDays: 9,
      remainingDays: 3,
    });

    const result = await updatePeriodOverride("period-1", 9);

    expect(result.success).toBe(true);
    expect(prismaMock.vacationPeriod.update).toHaveBeenCalledWith({
      where: { id: "period-1" },
      data: { overrideDays: 9 },
    });
  });

  it("clearing the override falls back to the rule grant", async () => {
    getPeriodBalance.mockResolvedValue({
      allottedDays: 12,
      usedDays: 3,
      remainingDays: 9,
    });

    const result = await updatePeriodOverride("period-1", null);

    expect(result).toEqual({
      success: true,
      data: { id: "period-1", allottedDays: 12 },
    });
  });
});
