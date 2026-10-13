import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, permission, resolve, balance } = vi.hoisted(() => ({
  db: {
    vacation: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    businessCorrection: { create: vi.fn() },
    holiday: { findMany: vi.fn() },
  },
  permission: vi.fn(),
  resolve: vi.fn(),
  balance: vi.fn(),
}));
vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: db }));
vi.mock("@/lib/auth/auth", () => ({ requirePermission: permission }));
vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction: (run: (tx: unknown) => unknown) => run(db),
}));
vi.mock("@/lib/services/vacation-periods", () => ({
  resolveVacationPeriod: resolve,
  getPeriodBalance: balance,
}));
vi.mock("@/lib/notifications", () => ({}));

import { revalidatePath } from "next/cache";
import { updateVacation } from "./vacations";

const date = (key: string) => new Date(`${key}T00:00:00Z`);
const periodId = "cm00000000000000000000001";
const initial = () => ({
  id: "request",
  userId: "owner",
  active: true,
  statusId: 1,
  status: { code: "PENDIENTE" },
  startDate: new Date("2026-06-10T06:00:00Z"),
  endDate: new Date("2026-06-12T05:59:59.999Z"),
  reason: "Original",
  periodId,
  chargedDates: ["2026-06-10", "2026-06-11"],
  businessDaysUsed: 2,
  approvedById: null,
  approvedAt: null,
  correctionHistory: [],
  updatedAt: new Date("2026-06-01T12:00:00Z"),
});
let stored = initial();
const input = () => ({
  startDate: date("2026-06-10"),
  endDate: date("2026-06-12"),
  reason: "Changed",
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  stored = initial();
  permission.mockResolvedValue({
    id: "owner",
    permissions: new Set(),
    isSuperuser: false,
  });
  db.vacation.findUnique.mockImplementation(async () => ({ ...stored }));
  db.vacation.findUniqueOrThrow.mockImplementation(async () => ({ ...stored }));
  db.vacation.findFirst.mockResolvedValue(null);
  db.vacation.updateMany.mockImplementation(async ({ data }) => {
    stored = { ...stored, ...data };
    return { count: 1 };
  });
  db.user.findUnique.mockResolvedValue({ active: true });
  db.holiday.findMany.mockResolvedValue([]);
  resolve.mockResolvedValue({ id: periodId, periodNumber: 1 });
  balance.mockResolvedValue({ remainingDays: 3 });
});
afterEach(() => vi.useRealTimers());

describe("pending vacation replacement", () => {
  it.each(["owner", "manager"])(
    "allows %s and audits immutable holder and before/after",
    async (actor) => {
      permission.mockResolvedValue({
        id: actor,
        permissions: new Set(actor === "manager" ? ["vacations:manage"] : []),
        isSuperuser: false,
      });
      expect(await updateVacation("request", input())).toMatchObject({
        success: true,
        data: { userId: "owner", businessDaysUsed: 3 },
      });
      expect(permission).toHaveBeenCalledWith("vacations:update");
      expect(resolve).toHaveBeenCalledWith(
        "owner",
        expect.any(Date),
        expect.any(Date),
        db,
        undefined,
        3,
        { excludeVacationId: "request" },
      );
      expect(balance).toHaveBeenCalledWith(periodId, db, {
        excludeVacationId: "request",
      });
      expect(db.vacation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: "request" } }),
        }),
      );
      expect(db.businessCorrection.create).toHaveBeenCalledExactlyOnceWith({
        data: expect.objectContaining({
          actorId: actor,
          entityType: "Vacation",
          entityId: "request",
          before: expect.objectContaining({
            operation: "PENDING_EDIT",
            userId: "owner",
            businessDaysUsed: 2,
          }),
          after: expect.objectContaining({
            operation: "PENDING_EDIT",
            userId: "owner",
            businessDaysUsed: 3,
            approvedById: null,
          }),
        }),
      });
      expect(revalidatePath).toHaveBeenCalledWith("/vacations");
      expect(revalidatePath).toHaveBeenCalledWith("/admin/vacations");
    },
  );
  it("denies cross-owner edits", async () => {
    permission.mockResolvedValue({ id: "other", permissions: new Set() });
    expect(await updateVacation("request", input())).toMatchObject({
      success: false,
    });
    expect(db.vacation.updateMany).not.toHaveBeenCalled();
  });
  it.each(["userId", "statusId", "approvedById", "approvedAt", "active"])(
    "strictly rejects injected %s",
    async (field) => {
      expect(
        await updateVacation("request", { ...input(), [field]: "injected" }),
      ).toMatchObject({ success: false });
      expect(db.vacation.findUnique).not.toHaveBeenCalled();
    },
  );
  it.each(["APROBADA", "RECHAZADA", "CANCELADA"])(
    "rejects stale %s without writes",
    async (code) => {
      stored.status.code = code;
      if (code === "CANCELADA") stored.active = false;
      expect(await updateVacation("request", input())).toMatchObject({
        success: false,
      });
      expect(db.vacation.updateMany).not.toHaveBeenCalled();
      expect(db.businessCorrection.create).not.toHaveBeenCalled();
    },
  );
  it("rejects a conditional write loser with no audit", async () => {
    db.vacation.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateVacation("request", input())).toMatchObject({
      success: false,
    });
    expect(db.vacation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        active: true,
        status: { code: "PENDIENTE" },
        updatedAt: stored.updatedAt,
      }),
      data: expect.any(Object),
    });
    expect(db.businessCorrection.create).not.toHaveBeenCalled();
  });
  it("preserves reason-only funding, consumption, approval and prior correction snapshots", async () => {
    stored.correctionHistory = [{ old: true }] as never;
    const before = { ...stored };
    expect(
      await updateVacation("request", {
        ...input(),
        endDate: date("2026-06-11"),
      }),
    ).toMatchObject({ success: true });
    expect(stored).toEqual({
      ...before,
      reason: "Changed",
      updatedById: "owner",
    });
    expect(resolve).not.toHaveBeenCalled();
    expect(db.holiday.findMany).not.toHaveBeenCalled();
    expect(db.vacation.updateMany.mock.calls[0][0].data).toEqual({
      reason: "Changed",
      updatedById: "owner",
    });
  });
  it.each([
    { startDate: new Date("invalid") },
    { endDate: date("2026-06-09") },
    { reason: "x".repeat(1001) },
  ])(
    "returns invalid input errors without opening a transaction",
    async (invalid) => {
      expect(
        await updateVacation("request", { ...input(), ...invalid }),
      ).toMatchObject({ success: false, error: expect.any(String) });
      expect(db.vacation.findUnique).not.toHaveBeenCalled();
    },
  );
  it.each(["overlap", "balance", "zero", "retroactive"])(
    "rejects %s without replacement or audit",
    async (failure) => {
      const data = input();
      if (failure === "overlap")
        db.vacation.findFirst.mockResolvedValue({ id: "other" });
      if (failure === "balance")
        balance.mockResolvedValue({ remainingDays: 2 });
      if (failure === "zero") {
        data.startDate = date("2026-06-14");
        data.endDate = date("2026-06-14");
      }
      if (failure === "retroactive") data.startDate = date("2026-05-30");
      expect(await updateVacation("request", data)).toMatchObject({
        success: false,
      });
      expect(db.vacation.updateMany).not.toHaveBeenCalled();
      expect(db.businessCorrection.create).not.toHaveBeenCalled();
    },
  );
  it("requires a retroactive administrator reason", async () => {
    permission.mockResolvedValue({
      id: "manager",
      permissions: new Set(["vacations:manage"]),
    });
    expect(
      await updateVacation("request", {
        ...input(),
        startDate: date("2026-05-30"),
        reason: " ",
      }),
    ).toMatchObject({ success: false });
    expect(db.vacation.updateMany).not.toHaveBeenCalled();
  });
  it("treats a changed explicit period as replacement", async () => {
    const next = "cm00000000000000000000002";
    resolve.mockResolvedValue({ id: next });
    expect(
      await updateVacation("request", {
        ...input(),
        endDate: date("2026-06-11"),
        periodId: next,
      }),
    ).toMatchObject({ success: true, data: { periodId: next } });
    expect(resolve).toHaveBeenCalledWith(
      "owner",
      expect.any(Date),
      expect.any(Date),
      db,
      next,
      2,
      { excludeVacationId: "request" },
    );
  });
  it("preserves legacy instants and missing daily snapshots on a civil-date reason-only edit", async () => {
    stored.startDate = new Date("2026-06-10T15:00:00Z");
    stored.endDate = new Date("2026-06-11T15:00:00Z");
    stored.chargedDates = [];
    const before = { ...stored };
    expect(
      await updateVacation("request", {
        ...input(),
        endDate: date("2026-06-11"),
      }),
    ).toMatchObject({ success: true });
    expect(stored).toEqual({
      ...before,
      reason: "Changed",
      updatedById: "owner",
    });
    expect(resolve).not.toHaveBeenCalled();
    expect(db.holiday.findMany).not.toHaveBeenCalled();
  });

  it("propagates audit failure through the transaction for rollback and never revalidates", async () => {
    db.businessCorrection.create.mockRejectedValue(
      new Error("Audit unavailable"),
    );
    await expect(updateVacation("request", input())).rejects.toThrow(
      "Audit unavailable",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
