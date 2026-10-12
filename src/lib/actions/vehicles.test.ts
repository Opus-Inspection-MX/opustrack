import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, requirePermission, permissions, runTransaction } = vi.hoisted(
  () => ({
    tx: {
      vehicle: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      vehicleStatus: { findUnique: vi.fn() },
      vehicleTrip: { count: vi.fn() },
      user: { findFirst: vi.fn() },
      businessCorrection: { create: vi.fn() },
    },
    requirePermission: vi.fn(),
    permissions: new Set<string>(),
    runTransaction: vi.fn(),
  }),
);

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: tx }));
vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction: runTransaction,
}));
vi.mock("@/lib/auth/auth", () => ({ requirePermission }));
vi.mock("@/lib/authz/authz", () => ({
  userHasPermission: (_user: unknown, permission: string) =>
    permissions.has(permission),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

import {
  correctVehicleOdometer,
  createVehicle,
  deleteVehicle,
  getVehicleById,
  updateVehicle,
  updateVehicleStatus,
  type VehicleFormData,
} from "./vehicles";

const form: VehicleFormData = {
  make: "Toyota",
  model: "Corolla",
  year: 2023,
  licensePlate: "ABC-123",
  status: "AVAILABLE",
  assignedFsrId: "fsr1",
};

beforeEach(() => {
  vi.resetAllMocks();
  permissions.clear();
  requirePermission.mockResolvedValue({ id: "admin1" });
  runTransaction.mockImplementation((run: (client: unknown) => unknown) =>
    run(tx),
  );
  tx.vehicle.findUnique.mockResolvedValue({
    id: "v1",
    active: true,
    odometerBaseline: 1000,
    odometerBaselineAt: new Date("2026-01-01T12:00:00Z"),
  });
  tx.vehicle.create.mockResolvedValue({ id: "v1" });
  tx.vehicle.update.mockResolvedValue({ id: "v1" });
  tx.vehicleTrip.count.mockResolvedValue(0);
  tx.user.findFirst.mockResolvedValue({ id: "fsr1" });
  tx.vehicleStatus.findUnique.mockImplementation(async ({ where }) => ({
    id: where.code === "IN_USE" ? 2 : where.code === "MAINTENANCE" ? 3 : 1,
    code: where.code,
  }));
  tx.businessCorrection.create.mockResolvedValue({ id: "correction1" });
});

describe("operational vehicle status", () => {
  it.each(["create", "update", "status"])(
    "rejects fabricated IN_USE through %s",
    async (kind) => {
      const result =
        kind === "create"
          ? await createVehicle({ ...form, status: "IN_USE" })
          : kind === "update"
            ? await updateVehicle("v1", { ...form, status: "IN_USE" })
            : await updateVehicleStatus("v1", "IN_USE");
      expect(result).toMatchObject({ success: false });
      expect(tx.vehicle.create).not.toHaveBeenCalled();
      expect(tx.vehicle.update).not.toHaveBeenCalled();
    },
  );

  it.each(["create", "update", "status"])(
    "rejects missing/inactive catalog through %s without falling back to id 1",
    async (kind) => {
      tx.vehicleStatus.findUnique.mockResolvedValue(null);
      const result =
        kind === "create"
          ? await createVehicle(form)
          : kind === "update"
            ? await updateVehicle("v1", form)
            : await updateVehicleStatus("v1", "AVAILABLE");
      expect(result).toMatchObject({ success: false });
      expect(tx.vehicle.create).not.toHaveBeenCalled();
      expect(tx.vehicle.update).not.toHaveBeenCalled();
    },
  );

  it.each(["create", "update"])(
    "validates an active FSR server-side through %s",
    async (kind) => {
      tx.user.findFirst.mockResolvedValue(null);
      expect(
        kind === "create"
          ? await createVehicle(form)
          : await updateVehicle("v1", form),
      ).toMatchObject({ success: false });
      expect(tx.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "fsr1",
            active: true,
            userRoles: expect.any(Object),
          }),
        }),
      );
      expect(tx.vehicle.create).not.toHaveBeenCalled();
      expect(tx.vehicle.update).not.toHaveBeenCalled();
    },
  );

  it.each(["update", "status"])(
    "blocks AVAILABLE during an open trip through %s",
    async (kind) => {
      tx.vehicleTrip.count.mockResolvedValue(1);
      expect(
        kind === "update"
          ? await updateVehicle("v1", form)
          : await updateVehicleStatus("v1", "AVAILABLE"),
      ).toMatchObject({
        success: false,
        error: expect.stringMatching(/viaje en curso/),
      });
      expect(tx.vehicle.update).not.toHaveBeenCalled();
    },
  );

  it("persists maintenance separately while still displaying occupation", async () => {
    tx.vehicleTrip.count.mockResolvedValue(1);
    expect(await updateVehicleStatus("v1", "MAINTENANCE")).toMatchObject({
      success: true,
    });
    expect(tx.vehicle.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: {
        statusId: 2,
        operationalStatusCode: "MAINTENANCE",
        updatedById: "admin1",
      },
    });
  });

  it("creates a validated operational status with attribution", async () => {
    expect(await createVehicle(form)).toMatchObject({ success: true });
    expect(tx.vehicle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusId: 1,
          operationalStatusCode: "AVAILABLE",
          createdById: "admin1",
        }),
      }),
    );
  });

  it("rechecks active vehicle and open trips before deletion", async () => {
    tx.vehicle.findUnique.mockResolvedValue(null);
    expect(await deleteVehicle("v1")).toMatchObject({ success: false });
    tx.vehicle.findUnique.mockResolvedValue({ id: "v1", active: true });
    tx.vehicleTrip.count.mockResolvedValue(1);
    expect(await deleteVehicle("v1")).toMatchObject({ success: false });
    expect(tx.vehicle.update).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "scopes vehicle detail trips and counts (manage-all=%s)",
    async (manageAll) => {
      if (manageAll) permissions.add("vehicle-trips:manage-all");
      await getVehicleById("v1");
      const where = manageAll
        ? { active: true }
        : { active: true, fsrId: "admin1" };
      expect(tx.vehicle.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            trips: expect.objectContaining({ where }),
            _count: { select: { trips: { where } } },
          }),
        }),
      );
    },
  );
});

describe("audited odometer correction", () => {
  it("requires both vehicle update and trip manage-all permissions", async () => {
    requirePermission.mockImplementation(async (permission) => {
      if (permission === "vehicle-trips:manage-all")
        throw new Error("Forbidden");
      return { id: "admin1" };
    });
    await expect(
      correctVehicleOdometer("v1", 0, "Odometer replaced"),
    ).rejects.toThrow("Forbidden");
    expect(
      requirePermission.mock.calls.map(([permission]) => permission),
    ).toEqual(["vehicles:update", "vehicle-trips:manage-all"]);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, 2147483648, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid reading %s",
    async (reading) => {
      expect(
        await correctVehicleOdometer("v1", reading, "Replacement"),
      ).toMatchObject({ success: false });
      expect(tx.vehicle.update).not.toHaveBeenCalled();
      expect(tx.businessCorrection.create).not.toHaveBeenCalled();
    },
  );

  it("requires a nonblank reason", async () => {
    expect(await correctVehicleOdometer("v1", 10, " ")).toMatchObject({
      success: false,
    });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("blocks correction while occupied or inactive/deleted", async () => {
    tx.vehicleTrip.count.mockResolvedValue(1);
    expect(await correctVehicleOdometer("v1", 10, "Replacement")).toMatchObject(
      { success: false },
    );
    tx.vehicle.findUnique.mockResolvedValue(null);
    expect(await correctVehicleOdometer("v1", 10, "Replacement")).toMatchObject(
      { success: false },
    );
    expect(tx.vehicle.update).not.toHaveBeenCalled();
    expect(tx.businessCorrection.create).not.toHaveBeenCalled();
  });

  it("sets a lower or zero baseline and appends immutable before/after in the same transaction", async () => {
    expect(
      await correctVehicleOdometer("v1", 0, " Odometer replaced "),
    ).toMatchObject({ success: true, data: { id: "correction1" } });
    expect(runTransaction).toHaveBeenCalledTimes(1);
    const baselineAt =
      tx.vehicle.update.mock.calls[0][0].data.odometerBaselineAt;
    expect(tx.vehicle.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: {
        odometerBaseline: 0,
        odometerBaselineAt: expect.any(Date),
        updatedById: "admin1",
      },
    });
    expect(tx.businessCorrection.create).toHaveBeenCalledWith({
      data: {
        entityType: "Vehicle",
        entityId: "v1",
        actorId: "admin1",
        reason: "Odometer replaced",
        before: {
          odometerBaseline: 1000,
          odometerBaselineAt: "2026-01-01T12:00:00.000Z",
        },
        after: {
          odometerBaseline: 0,
          odometerBaselineAt: baselineAt.toISOString(),
        },
      },
    });
    expect(tx.vehicle.update.mock.invocationCallOrder[0]).toBeLessThan(
      tx.businessCorrection.create.mock.invocationCallOrder[0],
    );
  });

  it("propagates audit failure so the transaction rolls back rather than accepting an unaudited correction", async () => {
    tx.businessCorrection.create.mockRejectedValue(
      new Error("audit unavailable"),
    );
    await expect(
      correctVehicleOdometer("v1", 50, "Replacement"),
    ).rejects.toThrow("audit unavailable");
  });
});
