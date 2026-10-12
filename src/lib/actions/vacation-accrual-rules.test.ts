import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  tx,
  requirePermission,
  serializableTransaction,
  revalidatePath,
  committed,
} = vi.hoisted(() => ({
  prismaMock: {
    vacationAccrualRule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    vacationSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
  tx: {
    vacationAccrualRule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    vacationSetting: { upsert: vi.fn() },
  },
  requirePermission: vi.fn(),
  serializableTransaction: vi.fn(),
  revalidatePath: vi.fn(),
  committed: { value: false },
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction,
}));
vi.mock("@/lib/auth/auth", () => ({ requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn() } }));

import {
  type AccrualRuleFormData,
  createAccrualRule,
  deleteAccrualRule,
  getAccrualRuleById,
  getAccrualRules,
  getVacationSetting,
  updateAccrualRule,
  updateVacationSetting,
} from "./vacation-accrual-rules";

const input: AccrualRuleFormData = { minYears: 6, maxYears: 10, days: 20 };
const existing = {
  id: 7,
  minYears: 6,
  maxYears: 10,
  days: 20,
  active: true,
  createdById: "original-admin",
};

beforeEach(() => {
  vi.resetAllMocks();
  committed.value = false;
  requirePermission.mockResolvedValue({ id: "vacation-admin" });
  serializableTransaction.mockImplementation(
    async (operation: (client: typeof tx) => Promise<unknown>) => {
      const result = await operation(tx);
      committed.value = true;
      return result;
    },
  );
  revalidatePath.mockImplementation(() => {
    expect(committed.value).toBe(true);
  });
  tx.vacationAccrualRule.findMany.mockResolvedValue([]);
  tx.vacationAccrualRule.findFirst.mockResolvedValue(existing);
  tx.vacationAccrualRule.create.mockImplementation(async ({ data }) => ({
    id: 8,
    ...data,
  }));
  tx.vacationAccrualRule.update.mockImplementation(async ({ data }) => ({
    ...existing,
    ...data,
  }));
  tx.vacationAccrualRule.updateMany.mockResolvedValue({ count: 1 });
  tx.vacationSetting.upsert.mockResolvedValue({ id: 1, graceWindowMonths: 6 });
});

function expectNoGlobalMutation(): void {
  expect(prismaMock.vacationAccrualRule.findMany).not.toHaveBeenCalled();
  expect(prismaMock.vacationAccrualRule.findFirst).not.toHaveBeenCalled();
  expect(prismaMock.vacationAccrualRule.create).not.toHaveBeenCalled();
  expect(prismaMock.vacationAccrualRule.update).not.toHaveBeenCalled();
  expect(prismaMock.vacationAccrualRule.updateMany).not.toHaveBeenCalled();
  expect(prismaMock.vacationSetting.upsert).not.toHaveBeenCalled();
}

describe("atomic vacation accrual intervals", () => {
  it.each([
    { minYears: 1, maxYears: 6 },
    { minYears: 10, maxYears: 15 },
    { minYears: 7, maxYears: 8 },
    { minYears: 1, maxYears: null },
  ])("rejects overlapping creation without writing (%j)", async (range) => {
    tx.vacationAccrualRule.findMany.mockResolvedValue([{ id: 2, ...range }]);
    const result = await createAccrualRule(input);
    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/traslapa/),
    });
    expect(tx.vacationAccrualRule.findMany).toHaveBeenCalledWith({
      where: { active: true },
    });
    expect(tx.vacationAccrualRule.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expectNoGlobalMutation();
  });

  it("rejects an open-ended new interval that contains a later tier", async () => {
    tx.vacationAccrualRule.findMany.mockResolvedValue([
      { id: 2, minYears: 15, maxYears: 20 },
    ]);
    expect(
      (await createAccrualRule({ ...input, maxYears: null })).success,
    ).toBe(false);
    expect(tx.vacationAccrualRule.create).not.toHaveBeenCalled();
  });

  it("creates an adjacent interval on the transaction client and stamps its actor", async () => {
    tx.vacationAccrualRule.findMany.mockResolvedValue([
      { id: 2, minYears: 1, maxYears: 5 },
      { id: 3, minYears: 11, maxYears: null },
    ]);
    expect(await createAccrualRule(input)).toMatchObject({
      success: true,
      data: { minYears: 6, maxYears: 10, days: 20 },
    });
    expect(serializableTransaction).toHaveBeenCalledTimes(1);
    expect(tx.vacationAccrualRule.create).toHaveBeenCalledWith({
      data: {
        ...input,
        active: true,
        createdById: "vacation-admin",
        updatedById: "vacation-admin",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith(
      "/admin/settings/vacation-accrual",
    );
    expect(requirePermission).toHaveBeenCalledWith("vacations:manage");
    expectNoGlobalMutation();
  });

  it("rejects overlapping edits without updating the target", async () => {
    tx.vacationAccrualRule.findMany.mockResolvedValue([
      { id: 2, minYears: 8, maxYears: 12 },
    ]);
    expect(await updateAccrualRule(7, input)).toMatchObject({
      success: false,
      error: expect.stringMatching(/traslapa/),
    });
    expect(tx.vacationAccrualRule.findFirst).toHaveBeenCalledWith({
      where: { id: 7, active: true },
    });
    expect(tx.vacationAccrualRule.findMany).toHaveBeenCalledWith({
      where: { active: true, id: { not: 7 } },
    });
    expect(tx.vacationAccrualRule.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expectNoGlobalMutation();
  });

  it("updates an active tier while excluding itself and preserving its creator", async () => {
    expect(await updateAccrualRule(7, { ...input, days: 22 })).toMatchObject({
      success: true,
      data: {
        createdById: "original-admin",
        updatedById: "vacation-admin",
        days: 22,
      },
    });
    expect(tx.vacationAccrualRule.update).toHaveBeenCalledWith({
      where: { id: 7, active: true },
      data: { ...input, days: 22, updatedById: "vacation-admin" },
    });
    expectNoGlobalMutation();
  });

  it("returns a business-rule rejection for a missing or inactive edit target", async () => {
    tx.vacationAccrualRule.findFirst.mockResolvedValue(null);
    expect(await updateAccrualRule(7, input)).toMatchObject({
      success: false,
      error: expect.stringMatching(/no existe o está inactiva/),
    });
    expect(tx.vacationAccrualRule.findMany).not.toHaveBeenCalled();
    expect(tx.vacationAccrualRule.update).not.toHaveBeenCalled();
  });

  it("does not accept extra caller fields as rule or actor data", async () => {
    await createAccrualRule({
      ...input,
      active: false,
      createdById: "forged",
      overrideDays: 365,
    } as AccrualRuleFormData);
    expect(tx.vacationAccrualRule.create).toHaveBeenCalledWith({
      data: {
        ...input,
        active: true,
        createdById: "vacation-admin",
        updatedById: "vacation-admin",
      },
    });
  });

  it.each(["create", "update"])(
    "returns the unique-start conflict as a business rule (%s)",
    async (operation) => {
      const error = { code: "P2002", meta: { target: ["minYears"] } };
      tx.vacationAccrualRule.create.mockRejectedValue(error);
      tx.vacationAccrualRule.update.mockRejectedValue(error);
      const result =
        operation === "create"
          ? await createAccrualRule(input)
          : await updateAccrualRule(7, input);
      expect(result).toMatchObject({
        success: false,
        error: expect.stringMatching(/año inicial.*dada de baja/),
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("does not disguise infrastructure defects as business conflicts", async () => {
    tx.vacationAccrualRule.create.mockRejectedValue(
      new Error("Database connection failed"),
    );
    await expect(createAccrualRule(input)).rejects.toThrow(
      "Database connection failed",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not label an unrelated database unique failure as an overlapping tier", async () => {
    const error = Object.assign(new Error("Broken database sequence"), {
      code: "P2002",
      meta: { target: ["id"] },
    });
    tx.vacationAccrualRule.create.mockRejectedValue(error);
    await expect(createAccrualRule(input)).rejects.toBe(error);
  });
});

describe("database integer validation", () => {
  it.each([
    { minYears: 0 },
    { minYears: -1 },
    { minYears: 1.5 },
    { minYears: Number.NaN },
    { minYears: Number.POSITIVE_INFINITY },
    { minYears: 2_147_483_648 },
    { minYears: Number.MAX_SAFE_INTEGER },
    { maxYears: 0 },
    { maxYears: 5 },
    { maxYears: 6.5 },
    { maxYears: Number.NaN },
    { maxYears: 2_147_483_648 },
    { days: -1 },
    { days: 0.5 },
    { days: Number.POSITIVE_INFINITY },
    { days: 366 },
    { days: 2_147_483_648 },
  ])("rejects invalid bounds before any transaction (%j)", async (changes) => {
    const data = { ...input, ...changes };
    expect((await createAccrualRule(data)).success).toBe(false);
    expect((await updateAccrualRule(7, data)).success).toBe(false);
    expect(serializableTransaction).not.toHaveBeenCalled();
  });

  it("accepts the PostgreSQL Int upper boundary without inventing an entitlement tier", async () => {
    expect(
      (
        await createAccrualRule({
          minYears: 2_147_483_647,
          maxYears: 2_147_483_647,
          days: 0,
        })
      ).success,
    ).toBe(true);
    expect(tx.vacationAccrualRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        minYears: 2_147_483_647,
        maxYears: 2_147_483_647,
        days: 0,
      }),
    });
  });

  it.each([0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    "rejects invalid mutation identifiers (%s)",
    async (id) => {
      expect((await updateAccrualRule(id, input)).success).toBe(false);
      expect((await deleteAccrualRule(id)).success).toBe(false);
      expect(serializableTransaction).not.toHaveBeenCalled();
    },
  );
});

describe("soft deletion and grace settings", () => {
  it("deactivates only an active rule with actor and time evidence after commit", async () => {
    expect(await deleteAccrualRule(7)).toEqual({ success: true });
    expect(tx.vacationAccrualRule.updateMany).toHaveBeenCalledWith({
      where: { id: 7, active: true },
      data: {
        active: false,
        updatedById: "vacation-admin",
        deactivatedById: "vacation-admin",
        deactivatedAt: expect.any(Date),
      },
    });
    expect(requirePermission).toHaveBeenCalledWith("vacations:manage");
    expectNoGlobalMutation();
  });

  it("does not repeat a missing or inactive rule's deletion", async () => {
    tx.vacationAccrualRule.updateMany.mockResolvedValue({ count: 0 });
    expect(await deleteAccrualRule(7)).toMatchObject({
      success: false,
      error: expect.stringMatching(/inactiva/),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([0, 6, 120])(
    "upserts a valid grace window inside the shared serializable boundary (%s)",
    async (months) => {
      expect((await updateVacationSetting(months)).success).toBe(true);
      expect(tx.vacationSetting.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: { graceWindowMonths: months },
        create: { id: 1, graceWindowMonths: months },
      });
      expect(serializableTransaction).toHaveBeenCalledTimes(1);
      expect(requirePermission).toHaveBeenCalledWith("vacations:manage");
      expectNoGlobalMutation();
    },
  );

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 121, 2_147_483_648])(
    "rejects invalid grace windows without database work (%s)",
    async (months) => {
      expect((await updateVacationSetting(months)).success).toBe(false);
      expect(serializableTransaction).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("keeps reads outside mutation transactions and filters inactive rules", async () => {
    prismaMock.vacationAccrualRule.findMany.mockResolvedValue([existing]);
    prismaMock.vacationAccrualRule.findFirst.mockResolvedValue(existing);
    prismaMock.vacationSetting.findUnique.mockResolvedValue({
      id: 1,
      graceWindowMonths: 6,
    });
    expect(await getAccrualRules()).toEqual([existing]);
    expect(await getAccrualRuleById(7)).toEqual(existing);
    expect(prismaMock.vacationAccrualRule.findFirst).toHaveBeenCalledWith({
      where: { id: 7, active: true },
    });
    expect(await getVacationSetting()).toEqual({ id: 1, graceWindowMonths: 6 });
    expect(serializableTransaction).not.toHaveBeenCalled();
  });

  it("retains the existing grace fallback and returns null for an invalid read identifier", async () => {
    prismaMock.vacationSetting.findUnique.mockResolvedValue(null);
    expect(await getVacationSetting()).toMatchObject({
      id: 1,
      graceWindowMonths: 12,
    });
    expect(await getAccrualRuleById(2_147_483_648)).toBeNull();
    expect(prismaMock.vacationAccrualRule.findFirst).not.toHaveBeenCalled();
  });

  it("preserves permission enforcement before mutation or reads", async () => {
    requirePermission.mockRejectedValue(new Error("Permission denied"));
    await expect(createAccrualRule(input)).rejects.toThrow("Permission denied");
    await expect(updateVacationSetting(6)).rejects.toThrow("Permission denied");
    expect(serializableTransaction).not.toHaveBeenCalled();
  });
});
