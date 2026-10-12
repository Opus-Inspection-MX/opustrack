import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock, storageMock, permissions } = vi.hoisted(() => ({
  permissions: new Set<string>(),
  txMock: {
    vehicle: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    vehicleTrip: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    vehicleStatus: { findUnique: vi.fn() },
    vehicleTripStatus: { findUnique: vi.fn() },
    assignment: { findFirst: vi.fn() },
    userClientAssignment: { findMany: vi.fn() },
    holiday: { findMany: vi.fn() },
    vacation: { findFirst: vi.fn() },
    actionIdempotency: { create: vi.fn() },
  },
  prismaMock: {
    actionIdempotency: { findUnique: vi.fn() },
    vehicleTrip: { findUnique: vi.fn() },
    vehicle: { findUnique: vi.fn() },
    vehicleStatus: { findUnique: vi.fn() },
    vehicleTripStatus: { findUnique: vi.fn() },
    assignmentAssignee: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  storageMock: {
    assertAllowedUpload: vi.fn(),
    uploadFileFromBuffer: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requireAuth: async () => ({ id: "fsr-1" }),
  requirePermission: async () => ({ id: "fsr-1" }),
}));
vi.mock("@/lib/authz/authz", () => ({
  userHasPermission: (_user: unknown, permission: string) =>
    permissions.has(permission),
}));
vi.mock("@/lib/storage/file-storage", () => storageMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { isFailure } from "./result";
import {
  cancelVehicleTrip,
  deleteVehicleTrip,
  endVehicleTrip,
  startVehicleTrip,
} from "./vehicle-trips";

/**
 * Fase 5b (H-13): claim-first atomicity for vehicle trips.
 *
 * Pin transactional guards and conditional transition winners against mocked
 * delegates. Real database race isolation belongs to the integration suite.
 */

const LIVE_TRIP = {
  id: "t1",
  vehicleId: "v1",
  fsrId: "fsr-1",
  startOdometer: 1000,
};
const UPLOAD = { url: "http://storage/odo.jpg", provider: "filesystem" };

function photo(): File {
  // jsdom's File lacks arrayBuffer; the action reads it, so attach it.
  const file = new File(["bytes"], "odometro.jpg", { type: "image/jpeg" });
  (file as unknown as Record<string, unknown>).arrayBuffer = async () =>
    new TextEncoder().encode("bytes").buffer;
  return file;
}

function startForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("vehicleId", "v1");
  fd.append("startOdometer", "1000");
  fd.append("photo", photo());
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

function endForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("tripId", "t1");
  fd.append("endOdometer", "1050");
  fd.append("photo", photo());
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.resetAllMocks();
  permissions.clear();
  prismaMock.actionIdempotency.findUnique.mockResolvedValue(null);
  prismaMock.vehicleTrip.findUnique.mockResolvedValue(LIVE_TRIP);
  prismaMock.vehicle.findUnique.mockResolvedValue({
    id: "v1",
    status: { code: "AVAILABLE", name: "AVAILABLE" },
  });
  const vehicle = {
    id: "v1",
    active: true,
    operationalStatusCode: "AVAILABLE",
    odometerBaseline: null,
    odometerBaselineAt: null,
  };
  txMock.vehicle.findUnique.mockResolvedValue(vehicle);
  txMock.vehicle.findUniqueOrThrow.mockResolvedValue(vehicle);
  txMock.vehicleTrip.findFirst.mockResolvedValue(null);
  txMock.vehicleTrip.aggregate.mockResolvedValue({
    _max: { startOdometer: 900, endOdometer: 1000 },
  });
  txMock.vehicleTrip.findMany.mockResolvedValue([]);
  txMock.vehicleTrip.findUnique.mockResolvedValue({
    ...LIVE_TRIP,
    fsrId: "fsr-1",
    startedAt: new Date(Date.now() - 3600000),
    startCapturedAt: null,
    status: { code: "EN_CURSO" },
    notes: "Start evidence notes",
  });
  txMock.vehicleTrip.findUniqueOrThrow.mockResolvedValue(LIVE_TRIP);
  txMock.vehicleTrip.count.mockResolvedValue(0);
  txMock.vehicleTrip.updateMany.mockResolvedValue({ count: 1 });
  txMock.assignment.findFirst.mockResolvedValue({ id: "a1" });
  txMock.userClientAssignment.findMany.mockResolvedValue([{ clientId: "c1" }]);
  txMock.holiday.findMany.mockResolvedValue([]);
  txMock.vacation.findFirst.mockResolvedValue(null);
  // Statuses resolve by stable code (Fase 3 · H-08); fall back to the name
  // so rows that predate the backfill keep matching.
  prismaMock.vehicleStatus.findUnique.mockImplementation(
    async (args: { where: { code?: string; name?: string } }) => ({
      id: `${args.where.code ?? args.where.name}-id`,
    }),
  );
  prismaMock.vehicleTripStatus.findUnique.mockImplementation(
    async (args: { where: { code?: string; name?: string } }) => ({
      id: `${args.where.code ?? args.where.name}-id`,
    }),
  );
  txMock.vehicleStatus.findUnique.mockImplementation(
    async (args: { where: { code: string } }) => ({
      id: `${args.where.code}-id`,
      code: args.where.code,
    }),
  );
  txMock.vehicleTripStatus.findUnique.mockImplementation(
    async (args: { where: { code: string } }) => ({
      id: `${args.where.code}-id`,
      code: args.where.code,
    }),
  );
  prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
    (cb as (tx: unknown) => Promise<unknown>)(txMock),
  );
  txMock.vehicle.updateMany.mockResolvedValue({ count: 1 });
  txMock.vehicle.update.mockResolvedValue({});
  txMock.vehicleTrip.create.mockResolvedValue({ id: "t-new" });
  txMock.vehicleTrip.update.mockResolvedValue({ id: "t1" });
  txMock.actionIdempotency.create.mockResolvedValue({});
  storageMock.uploadFileFromBuffer.mockResolvedValue(UPLOAD);
  storageMock.deleteFile.mockResolvedValue({});
});

describe("startVehicleTrip claim-first", () => {
  it("reclama la llave dentro de la transacción con vehicle.update + trip.create", async () => {
    const result = await startVehicleTrip(
      startForm({ idempotencyKey: "key-5b-1" }),
    );

    expect(result.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.vehicleTrip.create).toHaveBeenCalledTimes(1);
    expect(txMock.actionIdempotency.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: "key-5b-1",
          action: "startVehicleTrip",
          actorId: "fsr-1",
          requestTargetId: "v1",
          targetId: "t-new",
        }),
      }),
    );
  });

  it("aplica la regla AVAILABLE como updateMany condicional (count === 1)", async () => {
    await startVehicleTrip(startForm({ idempotencyKey: "key-5b-2" }));

    expect(txMock.vehicle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "v1",
          active: true,
          operationalStatusCode: "AVAILABLE",
        }),
      }),
    );
  });

  it("si el vehículo dejó de estar disponible no crea el viaje", async () => {
    txMock.vehicle.updateMany.mockResolvedValue({ count: 0 });

    const result = await startVehicleTrip(startForm());

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) expect(result.error).toMatch(/disponible/);
    expect(txMock.vehicleTrip.create).not.toHaveBeenCalled();
  });

  it("un P2002 en la transacción converge en el viaje vivo y borra la foto huérfana", async () => {
    prismaMock.$transaction.mockRejectedValue({ code: "P2002" });
    // Pre-transaction replay misses; the converge lookup finds the winner.
    prismaMock.actionIdempotency.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        key: "key-5b-race",
        targetId: "t1",
        actorId: "fsr-1",
        action: "startVehicleTrip",
        requestTargetId: "v1",
      });

    const result = await startVehicleTrip(
      startForm({ idempotencyKey: "key-5b-race" }),
    );

    expect(result.success).toBe(true);
    if (result.success) expect((result.data as { id: string }).id).toBe("t1");
    expect(storageMock.deleteFile).toHaveBeenCalledWith(
      UPLOAD.url,
      UPLOAD.provider,
    );
  });

  it("dos inicios con la misma llave crean un solo viaje", async () => {
    let calls = 0;
    prismaMock.$transaction.mockImplementation(async (cb: unknown) => {
      calls += 1;
      if (calls === 1) return (cb as (tx: unknown) => Promise<unknown>)(txMock);
      throw { code: "P2002" };
    });
    // Both pre-transaction lookups miss; the loser converges on the winner.
    prismaMock.actionIdempotency.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        key: "key-5b-doble",
        targetId: "t-new",
        actorId: "fsr-1",
        action: "startVehicleTrip",
        requestTargetId: "v1",
      });
    prismaMock.vehicleTrip.findUnique.mockResolvedValue({
      ...LIVE_TRIP,
      id: "t-new",
    });

    const fd = () => startForm({ idempotencyKey: "key-5b-doble" });
    const [first, second] = await Promise.all([
      startVehicleTrip(fd()),
      startVehicleTrip(fd()),
    ]);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(txMock.vehicleTrip.create).toHaveBeenCalledTimes(1);
  });
});

describe("endVehicleTrip claim-first", () => {
  beforeEach(() => {
    prismaMock.vehicleTrip.findUnique.mockResolvedValue({
      id: "t1",
      fsrId: "fsr-1",
      vehicleId: "v1",
      startOdometer: 1000,
      status: { name: "EN_CURSO" },
    });
  });

  it("un P2002 en la transacción converge y borra la foto huérfana", async () => {
    prismaMock.$transaction.mockRejectedValue({ code: "P2002" });
    prismaMock.actionIdempotency.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        key: "key-5b-end",
        targetId: "t1",
        actorId: "fsr-1",
        action: "endVehicleTrip",
        requestTargetId: "t1",
      });
    // First vehicleTrip read validates the open trip; the converge reload
    // answers with the winner's live row.
    prismaMock.vehicleTrip.findUnique
      .mockResolvedValueOnce({
        id: "t1",
        fsrId: "fsr-1",
        vehicleId: "v1",
        startOdometer: 1000,
        status: { name: "EN_CURSO" },
      })
      .mockResolvedValue(LIVE_TRIP);

    const result = await endVehicleTrip(
      endForm({ idempotencyKey: "key-5b-end" }),
    );

    expect(result.success).toBe(true);
    expect(storageMock.deleteFile).toHaveBeenCalled();
  });
});

describe.each([
  ["startVehicleTrip", startVehicleTrip, startForm, "v1"],
  ["endVehicleTrip", endVehicleTrip, endForm, "t1"],
] as const)(
  "%s concurrent replay authorization",
  (action, run, form, requestTargetId) => {
    beforeEach(() => {
      prismaMock.$transaction.mockRejectedValue({ code: "P2002" });
      prismaMock.vehicleTrip.findUnique.mockResolvedValue({
        ...LIVE_TRIP,
        status: { code: "EN_CURSO" },
      });
      prismaMock.actionIdempotency.findUnique.mockResolvedValueOnce(null);
    });

    it.each([
      { actorId: "fsr-2" },
      { action: "otherAction" },
      { requestTargetId: "other-target" },
      { actorId: null },
    ])(
      "rejects a winner with another binding and cleans the losing upload (%j)",
      async (override) => {
        prismaMock.actionIdempotency.findUnique.mockResolvedValue({
          actorId: "fsr-1",
          action,
          requestTargetId,
          targetId: "t1",
          ...override,
        });
        expect(await run(form({ idempotencyKey: "race-key" }))).toMatchObject({
          success: false,
          error: expect.stringMatching(/llave de reintento/),
        });
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.vehicleTrip.findUnique).toHaveBeenCalledTimes(
          action === "endVehicleTrip" ? 1 : 0,
        );
        expect(storageMock.deleteFile).toHaveBeenCalledWith(
          UPLOAD.url,
          UPLOAD.provider,
        );
      },
    );

    it("rejects the real winner row if its owner changed", async () => {
      prismaMock.actionIdempotency.findUnique.mockResolvedValue({
        actorId: "fsr-1",
        action,
        requestTargetId,
        targetId: "t1",
      });
      if (action === "endVehicleTrip")
        prismaMock.vehicleTrip.findUnique.mockResolvedValueOnce({
          ...LIVE_TRIP,
          status: { code: "EN_CURSO" },
        });
      prismaMock.vehicleTrip.findUnique.mockResolvedValue({
        ...LIVE_TRIP,
        fsrId: "fsr-2",
      });
      expect(await run(form({ idempotencyKey: "race-key" }))).toMatchObject({
        success: false,
        error: expect.stringMatching(/propios viajes/),
      });
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(storageMock.deleteFile).toHaveBeenCalledWith(
        UPLOAD.url,
        UPLOAD.provider,
      );
    });
  },
);

describe("trip lifecycle policies", () => {
  it("uploads once when the serializable helper retries a conflicted start", async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce({ code: "P2034" })
      .mockImplementation(async (run: unknown) =>
        (run as (tx: unknown) => Promise<unknown>)(txMock),
      );
    expect(await startVehicleTrip(startForm())).toMatchObject({
      success: true,
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" }),
    );
    expect(storageMock.uploadFileFromBuffer).toHaveBeenCalledTimes(1);
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });

  it("persists capture time separately from reception and keeps start notes on finish", async () => {
    const capturedAt = new Date(Date.now() - 1800000).toISOString();
    expect(await startVehicleTrip(startForm({ capturedAt }))).toMatchObject({
      success: true,
    });
    expect(txMock.vehicleTrip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startCapturedAt: new Date(capturedAt),
        }),
      }),
    );
    expect(txMock.vehicleTrip.create.mock.calls[0][0].data).not.toHaveProperty(
      "startedAt",
    );
    prismaMock.vehicleTrip.findUnique.mockResolvedValue({
      ...LIVE_TRIP,
      fsrId: "fsr-1",
      status: { code: "EN_CURSO" },
    });
    expect(await endVehicleTrip(endForm({ capturedAt }))).toMatchObject({
      success: true,
    });
    const mutation = txMock.vehicleTrip.updateMany.mock.calls[0][0].data;
    expect(mutation).toMatchObject({
      endCapturedAt: new Date(capturedAt),
      notes: "Start evidence notes",
      kmDriven: 50,
    });
    expect(mutation.endedAt.getTime()).toBeGreaterThanOrEqual(
      new Date(capturedAt).getTime(),
    );
  });

  it("two concurrent finish attempts have one conditional winner and only one release", async () => {
    storageMock.uploadFileFromBuffer
      .mockResolvedValueOnce({ ...UPLOAD, url: "http://storage/winner.jpg" })
      .mockResolvedValueOnce({ ...UPLOAD, url: "http://storage/loser.jpg" });
    prismaMock.vehicleTrip.findUnique.mockResolvedValue({
      ...LIVE_TRIP,
      fsrId: "fsr-1",
      status: { code: "EN_CURSO" },
    });
    let won = false;
    txMock.vehicleTrip.updateMany.mockImplementation(async () => {
      if (won) return { count: 0 };
      won = true;
      return { count: 1 };
    });
    const results = await Promise.all([
      endVehicleTrip(endForm()),
      endVehicleTrip(endForm()),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter(isFailure)).toHaveLength(1);
    expect(txMock.vehicle.update).toHaveBeenCalledTimes(1);
    expect(storageMock.deleteFile).toHaveBeenCalledTimes(1);
    expect(storageMock.deleteFile).toHaveBeenCalledWith(
      txMock.vehicleTrip.updateMany.mock.calls[1][0].data.endPhotoUrl,
      UPLOAD.provider,
    );
    expect(storageMock.deleteFile).not.toHaveBeenCalledWith(
      txMock.vehicleTrip.updateMany.mock.calls[0][0].data.endPhotoUrl,
      UPLOAD.provider,
    );
  });

  it("deleting an open trip cancels before soft deletion and retains its evidence", async () => {
    await deleteVehicleTrip("t1", "Abandoned dispatch").catch(() => {});
    expect(txMock.vehicleTrip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusId: "CANCELADO-id",
          cancellationReason: "Abandoned dispatch",
        }),
      }),
    );
    expect(txMock.vehicleTrip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ active: false }),
      }),
    );
    expect(
      txMock.vehicleTrip.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(txMock.vehicleTrip.update.mock.invocationCallOrder[0]);
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });

  it.each(["vehicle", "driver"])(
    "rejects an open %s trip even for manage-all",
    async (owner) => {
      permissions.add("vehicle-trips:manage-all");
      txMock.vehicleTrip.findFirst.mockImplementation(async ({ where }) => {
        expect(where).toMatchObject({
          active: true,
          status: { code: "EN_CURSO" },
          OR: [{ vehicleId: "v1" }, { fsrId: "fsr-1" }],
        });
        return {
          id: owner === "driver" ? "other-vehicle-trip" : "same-vehicle-trip",
        };
      });
      expect(await startVehicleTrip(startForm())).toMatchObject({
        success: false,
        error: expect.stringMatching(/viaje en curso/),
      });
      expect(txMock.vehicleTrip.create).not.toHaveBeenCalled();
      expect(txMock.vehicle.updateMany).not.toHaveBeenCalled();
      expect(storageMock.deleteFile).toHaveBeenCalledWith(
        UPLOAD.url,
        UPLOAD.provider,
      );
    },
  );

  it("rejects a vehicle deleted before the transactional start", async () => {
    txMock.vehicle.findUnique.mockResolvedValue(null);
    expect(await startVehicleTrip(startForm())).toMatchObject({
      success: false,
    });
    expect(txMock.vehicleTrip.create).not.toHaveBeenCalled();
  });

  it.each(["-1", "1.5", "2147483648", "NaN"])(
    "rejects invalid odometer %s before uploading",
    async (reading) => {
      expect(
        await startVehicleTrip(startForm({ startOdometer: reading })),
      ).toMatchObject({ success: false });
      expect(
        await endVehicleTrip(endForm({ endOdometer: reading })),
      ).toMatchObject({ success: false });
      expect(storageMock.uploadFileFromBuffer).not.toHaveBeenCalled();
    },
  );

  it("allows zero for a new physical epoch", async () => {
    txMock.vehicleTrip.aggregate.mockResolvedValue({
      _max: { startOdometer: null, endOdometer: null },
    });
    expect(
      await startVehicleTrip(startForm({ startOdometer: "0" })),
    ).toMatchObject({ success: true });
  });

  it("keeps deleted and cancelled physical observations in monotonic validation", async () => {
    txMock.vehicleTrip.aggregate.mockResolvedValue({
      _max: { startOdometer: 1300, endOdometer: 1200 },
    });
    expect(await startVehicleTrip(startForm())).toMatchObject({
      success: false,
      error: expect.stringMatching(/1300/),
    });
    expect(txMock.vehicleTrip.aggregate).toHaveBeenCalledWith({
      where: { vehicleId: "v1" },
      _max: { startOdometer: true, endOdometer: true },
    });
  });

  it("ignores pre-baseline readings but includes post-baseline end observations", async () => {
    const baselineAt = new Date(Date.now() - 3600000);
    txMock.vehicle.findUnique.mockResolvedValue({
      id: "v1",
      operationalStatusCode: "AVAILABLE",
      odometerBaseline: 50,
      odometerBaselineAt: baselineAt,
    });
    txMock.vehicleTrip.findMany.mockResolvedValue([
      {
        startOdometer: 90000,
        endOdometer: 95000,
        startCapturedAt: new Date(baselineAt.getTime() - 10000),
        endCapturedAt: new Date(baselineAt.getTime() - 5000),
        startedAt: new Date(),
        endedAt: new Date(),
      },
      {
        startOdometer: 50,
        endOdometer: 70,
        startCapturedAt: new Date(baselineAt.getTime() - 5000),
        endCapturedAt: new Date(baselineAt.getTime() + 5000),
        startedAt: new Date(),
        endedAt: new Date(),
      },
    ]);
    expect(
      await startVehicleTrip(startForm({ startOdometer: "69" })),
    ).toMatchObject({ success: false, error: expect.stringMatching(/70/) });
    expect(
      await startVehicleTrip(startForm({ startOdometer: "70" })),
    ).toMatchObject({ success: true });
    expect(txMock.vehicleTrip.aggregate).not.toHaveBeenCalled();
  });

  it("uses legacy reception timestamps in the corrected epoch", async () => {
    const baselineAt = new Date(Date.now() - 3600000);
    txMock.vehicle.findUnique.mockResolvedValue({
      id: "v1",
      operationalStatusCode: "AVAILABLE",
      odometerBaseline: 50,
      odometerBaselineAt: baselineAt,
    });
    txMock.vehicleTrip.findMany.mockResolvedValue([
      {
        startOdometer: 80,
        endOdometer: null,
        startCapturedAt: null,
        endCapturedAt: null,
        startedAt: new Date(),
        endedAt: null,
      },
    ]);
    expect(
      await startVehicleTrip(startForm({ startOdometer: "79" })),
    ).toMatchObject({ success: false, error: expect.stringMatching(/80/) });
  });

  it("rejects captures before the correction and readings below the baseline", async () => {
    const baselineAt = new Date(Date.now() - 3600000);
    txMock.vehicle.findUnique.mockResolvedValue({
      id: "v1",
      operationalStatusCode: "AVAILABLE",
      odometerBaseline: 50,
      odometerBaselineAt: baselineAt,
    });
    expect(
      await startVehicleTrip(
        startForm({
          capturedAt: new Date(baselineAt.getTime() - 1).toISOString(),
        }),
      ),
    ).toMatchObject({
      success: false,
      error: expect.stringMatching(/corrección/),
    });
    expect(
      await startVehicleTrip(startForm({ startOdometer: "49" })),
    ).toMatchObject({ success: false, error: expect.stringMatching(/50/) });
  });

  it.each(["closed", "deleted", "out of scope", "not assigned"])(
    "rejects an assignment that is %s",
    async () => {
      txMock.assignment.findFirst.mockResolvedValue(null);
      expect(
        await startVehicleTrip(startForm({ assignmentId: "a1" })),
      ).toMatchObject({
        success: false,
        error: expect.stringMatching(/asignación/),
      });
      expect(txMock.assignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            active: true,
            status: {
              code: {
                in: [
                  "PENDIENTE_DE_ASIGNACION",
                  "ASIGNADO",
                  "VISTO",
                  "INICIADO",
                  "EN_PROGRESO",
                ],
              },
            },
            incident: expect.objectContaining({
              clientId: { in: ["c1"] },
              active: true,
            }),
            assignees: { some: { userId: "fsr-1", active: true } },
          }),
        }),
      );
      expect(txMock.vehicleTrip.create).not.toHaveBeenCalled();
    },
  );

  it("manage-all does not bypass assignment Cliente scope", async () => {
    permissions.add("vehicle-trips:manage-all");
    txMock.assignment.findFirst.mockResolvedValue(null);
    expect(
      await startVehicleTrip(startForm({ assignmentId: "a1" })),
    ).toMatchObject({ success: false });
    expect(txMock.assignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          incident: expect.objectContaining({ clientId: { in: ["c1"] } }),
        }),
      }),
    );
  });

  it("requires a manage-all reason during approved vacation and persists it separately", async () => {
    txMock.vacation.findFirst.mockResolvedValue({ id: "vacation1" });
    expect(
      await startVehicleTrip(startForm({ startExceptionReason: "Emergency" })),
    ).toMatchObject({ success: false });
    permissions.add("vehicle-trips:manage-all");
    expect(await startVehicleTrip(startForm())).toMatchObject({
      success: false,
    });
    expect(
      await startVehicleTrip(
        startForm({ startExceptionReason: " Emergency " }),
      ),
    ).toMatchObject({ success: true });
    expect(txMock.vehicleTrip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ startExceptionReason: "Emergency" }),
      }),
    );
  });

  it("rejects holiday start without an authorized exception", async () => {
    const day = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Mexico_City",
    }).format(new Date());
    txMock.holiday.findMany.mockResolvedValue([
      {
        month: Number(day.slice(5, 7)),
        day: Number(day.slice(8)),
        nthMonday: null,
        isRecurring: true,
        year: null,
      },
    ]);
    expect(await startVehicleTrip(startForm())).toMatchObject({
      success: false,
      error: expect.stringMatching(/festivo/),
    });
  });

  it("the conditional end loser does not release or overwrite the winner and cleans its upload", async () => {
    prismaMock.vehicleTrip.findUnique.mockResolvedValue({
      ...LIVE_TRIP,
      fsrId: "fsr-1",
      status: { code: "EN_CURSO" },
    });
    txMock.vehicleTrip.updateMany.mockResolvedValue({ count: 0 });
    expect(await endVehicleTrip(endForm())).toMatchObject({ success: false });
    expect(txMock.vehicleTrip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1", active: true, status: { code: "EN_CURSO" } },
      }),
    );
    expect(txMock.vehicle.update).not.toHaveBeenCalled();
    expect(txMock.vehicleTrip.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(storageMock.deleteFile).toHaveBeenCalledWith(
      UPLOAD.url,
      UPLOAD.provider,
    );
  });

  it("finishes during absence and restores maintenance, not available", async () => {
    prismaMock.vehicleTrip.findUnique.mockResolvedValue({
      ...LIVE_TRIP,
      fsrId: "fsr-1",
      status: { code: "EN_CURSO" },
    });
    txMock.vehicle.findUniqueOrThrow.mockResolvedValue({
      id: "v1",
      operationalStatusCode: "MAINTENANCE",
    });
    txMock.vacation.findFirst.mockResolvedValue({ id: "vacation1" });
    expect(await endVehicleTrip(endForm())).toMatchObject({ success: true });
    expect(txMock.vehicle.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { statusId: "MAINTENANCE-id", updatedById: "fsr-1" },
    });
    expect(prismaMock.vehicleTripStatus.findUnique).not.toHaveBeenCalled();
    expect(txMock.vehicleTripStatus.findUnique).toHaveBeenCalledWith({
      where: { code: "COMPLETADO", active: true },
    });
    expect(txMock.vacation.findFirst).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "rejects end capture before effective start (captured=%s)",
    async (captured) => {
      const start = new Date(Date.now() - 3600000);
      prismaMock.vehicleTrip.findUnique.mockResolvedValue({
        ...LIVE_TRIP,
        fsrId: "fsr-1",
        status: { code: "EN_CURSO" },
      });
      txMock.vehicleTrip.findUnique.mockResolvedValue({
        ...LIVE_TRIP,
        fsrId: "fsr-1",
        status: { code: "EN_CURSO" },
        startedAt: start,
        startCapturedAt: captured ? start : null,
      });
      expect(
        await endVehicleTrip(
          endForm({ capturedAt: new Date(start.getTime() - 1).toISOString() }),
        ),
      ).toMatchObject({
        success: false,
        error: expect.stringMatching(/anterior/),
      });
      expect(txMock.vehicleTrip.updateMany).not.toHaveBeenCalled();
      expect(storageMock.deleteFile).toHaveBeenCalled();
    },
  );

  it("rechecks active/open status inside end transaction", async () => {
    prismaMock.vehicleTrip.findUnique.mockResolvedValue({
      ...LIVE_TRIP,
      fsrId: "fsr-1",
      status: { code: "EN_CURSO" },
    });
    txMock.vehicleTrip.findUnique.mockResolvedValue(null);
    expect(await endVehicleTrip(endForm())).toMatchObject({ success: false });
    expect(txMock.vehicleTrip.updateMany).not.toHaveBeenCalled();
  });

  it("cancels with a reason while retaining evidence and operational inactivity", async () => {
    txMock.vehicle.findUniqueOrThrow.mockResolvedValue({
      id: "v1",
      operationalStatusCode: "INACTIVE",
    });
    expect(await cancelVehicleTrip("t1", " Dispatch withdrawn ")).toMatchObject(
      { success: true },
    );
    const mutation = txMock.vehicleTrip.updateMany.mock.calls[0][0];
    expect(mutation.data).toEqual({
      statusId: "CANCELADO-id",
      cancellationReason: "Dispatch withdrawn",
      cancelledAt: expect.any(Date),
      updatedById: "fsr-1",
    });
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
    expect(txMock.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusId: "INACTIVE-id" }),
      }),
    );
  });

  it("requires a cancellation reason and only releases after winning", async () => {
    expect(await cancelVehicleTrip("t1", " ")).toMatchObject({
      success: false,
    });
    txMock.vehicleTrip.updateMany.mockResolvedValue({ count: 0 });
    expect(await cancelVehicleTrip("t1", "Duplicate dispatch")).toMatchObject({
      success: false,
    });
    expect(txMock.vehicle.update).not.toHaveBeenCalled();
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });

  it("deleting an open trip requires a cancellation reason", async () => {
    expect(await deleteVehicleTrip("t1")).toMatchObject({ success: false });
    expect(txMock.vehicleTrip.update).not.toHaveBeenCalled();
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });

  it("deleting a finished trip retains photos and does not release its vehicle", async () => {
    txMock.vehicleTrip.findUnique.mockResolvedValue({
      ...LIVE_TRIP,
      fsrId: "fsr-1",
      status: { code: "COMPLETADO" },
    });
    await deleteVehicleTrip("t1").catch(() => {});
    expect(txMock.vehicleTrip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ active: false }),
      }),
    );
    expect(txMock.vehicle.update).not.toHaveBeenCalled();
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });
});
