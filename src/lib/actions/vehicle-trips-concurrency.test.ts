import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock, storageMock } = vi.hoisted(() => ({
  txMock: {
    vehicle: { updateMany: vi.fn(), update: vi.fn() },
    vehicleTrip: { create: vi.fn(), update: vi.fn() },
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
vi.mock("@/lib/authz/authz", () => ({ userHasPermission: () => false }));
vi.mock("@/lib/storage/file-storage", () => storageMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { isFailure } from "./result";
import { endVehicleTrip, startVehicleTrip } from "./vehicle-trips";

/**
 * Fase 5b (H-13): claim-first atomicity for vehicle trips.
 *
 * `vehicle.update` + `trip.create`/`trip.update` + idempotency claim share
 * ONE transaction claimed FIRST: a P2002 converges on the live trip instead
 * of surfacing a generic error, the AVAILABLE rule is a conditional
 * `updateMany` (`count === 1`), and an orphaned upload is deleted when the
 * transaction fails.
 *
 * No integration infra exists on main yet (Fase 2), so these pin the
 * contract against the mocked delegate.
 * TODO(int): promote to concurrency.int.test.ts once Fase 2 infra lands.
 */

const LIVE_TRIP = { id: "t1", vehicleId: "v1", startOdometer: 1000 };
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
  for (const [k, v] of Object.entries(overrides)) fd.append(k, v);
  return fd;
}

function endForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("tripId", "t1");
  fd.append("endOdometer", "1050");
  fd.append("photo", photo());
  for (const [k, v] of Object.entries(overrides)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.actionIdempotency.findUnique.mockResolvedValue(null);
  prismaMock.vehicleTrip.findUnique.mockResolvedValue(LIVE_TRIP);
  prismaMock.vehicle.findUnique.mockResolvedValue({
    id: "v1",
    status: { name: "AVAILABLE" },
  });
  prismaMock.vehicleStatus.findUnique.mockImplementation(
    async (args: { where: { name: string } }) => ({
      id: `${args.where.name}-id`,
    }),
  );
  prismaMock.vehicleTripStatus.findUnique.mockImplementation(
    async (args: { where: { name: string } }) => ({
      id: `${args.where.name}-id`,
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
          statusId: "AVAILABLE-id",
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
      .mockResolvedValueOnce({ key: "key-5b-race", targetId: "t1" });

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
      .mockResolvedValueOnce({ key: "key-5b-doble", targetId: "t-new" });
    prismaMock.vehicleTrip.findUnique.mockResolvedValue({ id: "t-new" });

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
      .mockResolvedValueOnce({ key: "key-5b-end", targetId: "t1" });
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
