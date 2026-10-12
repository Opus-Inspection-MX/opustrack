import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { tx, notifyVacationCancelled, notifyVacationCorrected, committed } =
  vi.hoisted(() => ({
    tx: {
      vacation: { findUnique: vi.fn(), updateMany: vi.fn() },
      holiday: { findMany: vi.fn() },
      businessCorrection: { create: vi.fn() },
    },
    notifyVacationCancelled: vi.fn(),
    notifyVacationCorrected: vi.fn(),
    committed: { value: false },
  }));
vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: tx }));
vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction: async (run: (client: unknown) => unknown) => {
    committed.value = false;
    const result = await run(tx);
    committed.value = true;
    return result;
  },
}));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/notifications", () => ({
  notifyVacationCancelled,
  notifyVacationCorrected,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { correctStartedVacation } from "./vacations";

const row = {
  id: "vacation",
  active: true,
  userId: "employee",
  statusId: 2,
  status: { code: "APROBADA" },
  startDate: new Date("2026-06-01T06:00:00Z"),
  endDate: new Date("2026-06-06T05:59:59.999Z"),
  businessDaysUsed: 4,
  // June 3 was a holiday at creation; it must stay free after catalog edits.
  reason: "Summer",
  chargedDates: ["2026-06-01", "2026-06-02", "2026-06-04", "2026-06-05"],
  periodId: "period-1",
  correctionHistory: [{ reason: "Previously imported audit" }],
  approvedById: "original-approver",
  approvedAt: new Date("2026-05-28T12:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  committed.value = false;
  notifyVacationCorrected.mockImplementation(async () => {
    expect(committed.value).toBe(true);
    expect(tx.businessCorrection.create).toHaveBeenCalled();
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
  tx.vacation.findUnique.mockResolvedValue({ ...row });
  tx.vacation.updateMany.mockResolvedValue({ count: 1 });
  tx.businessCorrection.create.mockResolvedValue({ id: "correction" });
});
afterEach(() => vi.useRealTimers());

describe("started vacation correction", () => {
  it("retains all elapsed days using the original snapshot, releases only future days, and audits the reason", async () => {
    const result = await correctStartedVacation(
      "vacation",
      new Date("2026-06-03T00:00:00Z"),
      "Early return",
    );
    expect(result).toMatchObject({
      success: true,
      data: { retainedDays: 2, releasedDays: 2 },
    });
    const update = tx.vacation.updateMany.mock.calls[0][0];
    expect(update.data).toMatchObject({
      businessDaysUsed: 2,
      endDate: new Date("2026-06-04T05:59:59.999Z"),
      updatedById: "admin-1",
    });
    expect(update.data).not.toHaveProperty("reason");
    expect(update.data).not.toHaveProperty("chargedDates");
    expect(update.data).not.toHaveProperty("correctionHistory");
    expect(tx.businessCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "Vacation",
        entityId: "vacation",
        actorId: "admin-1",
        reason: "Early return",
        before: expect.objectContaining({
          businessDaysUsed: 4,
          reason: "Summer",
          chargedDates: row.chargedDates,
          approvedById: "original-approver",
          correctionHistory: row.correctionHistory,
        }),
        after: expect.objectContaining({
          businessDaysUsed: 2,
          reason: "Summer",
          chargedDates: row.chargedDates,
          reviewedConsumedDays: null,
        }),
      }),
    });
    expect(tx.holiday.findMany).not.toHaveBeenCalled();
    expect(notifyVacationCorrected).toHaveBeenCalledTimes(1);
    expect(notifyVacationCorrected).toHaveBeenCalledWith(
      "vacation",
      "employee",
      "admin-1",
    );
    expect(notifyVacationCancelled).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-06-02", "Early return"],
    ["2026-06-05", "Early return"],
    ["2026-06-03", " "],
  ])(
    "rejects destructive or unaudited correction (%s)",
    async (day, reason) => {
      expect(
        (
          await correctStartedVacation(
            "vacation",
            new Date(`${day}T00:00:00Z`),
            reason,
          )
        ).success,
      ).toBe(false);
      expect(tx.vacation.updateMany).not.toHaveBeenCalled();
      expect(notifyVacationCorrected).not.toHaveBeenCalled();
      expect(notifyVacationCancelled).not.toHaveBeenCalled();
    },
  );

  it("requires an explicit reviewed consumption count for legacy rows", async () => {
    tx.vacation.findUnique.mockResolvedValue({
      ...row,
      reason: "Legacy",
      chargedDates: [],
    });
    const day = new Date("2026-06-03T00:00:00Z");
    expect(
      (await correctStartedVacation("vacation", day, "Reviewed attendance"))
        .success,
    ).toBe(false);
    expect(
      (await correctStartedVacation("vacation", day, "Reviewed attendance", 5))
        .success,
    ).toBe(false);
    expect(
      await correctStartedVacation("vacation", day, "Reviewed attendance", 2),
    ).toMatchObject({ success: true, data: { retainedDays: 2 } });
    expect(tx.businessCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        after: expect.objectContaining({ reviewedConsumedDays: 2 }),
      }),
    });
    expect(notifyVacationCorrected).toHaveBeenCalledTimes(1);
    expect(notifyVacationCancelled).not.toHaveBeenCalled();
  });

  it("does not notify when the conditional correction loses", async () => {
    tx.vacation.updateMany.mockResolvedValue({ count: 0 });
    expect(
      (
        await correctStartedVacation(
          "vacation",
          new Date("2026-06-03T00:00:00Z"),
          "Early return",
        )
      ).success,
    ).toBe(false);
    expect(notifyVacationCancelled).not.toHaveBeenCalled();
    expect(notifyVacationCorrected).not.toHaveBeenCalled();
    expect(tx.businessCorrection.create).not.toHaveBeenCalled();
  });

  it("keeps the original snapshot across repeated truncations", async () => {
    tx.vacation.findUnique.mockResolvedValue({
      ...row,
      endDate: new Date("2026-06-05T05:59:59.999Z"),
      businessDaysUsed: 3,
    });
    expect(
      await correctStartedVacation(
        "vacation",
        new Date("2026-06-03T00:00:00Z"),
        "Second early return",
      ),
    ).toMatchObject({
      success: true,
      data: { retainedDays: 2, releasedDays: 1 },
    });
    expect(tx.businessCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        before: expect.objectContaining({
          businessDaysUsed: 3,
          chargedDates: row.chargedDates,
        }),
      }),
    });
  });

  it.each([
    { active: false },
    { status: { code: "PENDIENTE" } },
    { startDate: new Date("2026-06-04T06:00:00Z") },
    { businessDaysUsed: null },
  ])(
    "rejects unavailable or unconciliated history before writing",
    async (changes) => {
      tx.vacation.findUnique.mockResolvedValue({ ...row, ...changes });
      expect(
        (
          await correctStartedVacation(
            "vacation",
            new Date("2026-06-03T00:00:00Z"),
            "Early return",
          )
        ).success,
      ).toBe(false);
      expect(tx.vacation.updateMany).not.toHaveBeenCalled();
      expect(tx.businessCorrection.create).not.toHaveBeenCalled();
      expect(notifyVacationCorrected).not.toHaveBeenCalled();
      expect(notifyVacationCancelled).not.toHaveBeenCalled();
    },
  );

  it("does not send either event when the audit transaction fails", async () => {
    tx.businessCorrection.create.mockRejectedValue(
      new Error("Audit write failed"),
    );
    await expect(
      correctStartedVacation(
        "vacation",
        new Date("2026-06-03T00:00:00Z"),
        "Early return",
      ),
    ).rejects.toThrow("Audit write failed");
    expect(committed.value).toBe(false);
    expect(notifyVacationCorrected).not.toHaveBeenCalled();
    expect(notifyVacationCancelled).not.toHaveBeenCalled();
  });
});
