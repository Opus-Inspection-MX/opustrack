import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermission } = vi.hoisted(() => ({
  prismaMock: {
    actionIdempotency: { findUnique: vi.fn(), create: vi.fn() },
    vehicleTrip: { findUnique: vi.fn() },
  },
  requirePermission: vi.fn(async (_name: string) => ({ id: "fsr-1" })),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requireAuth: () => requirePermission("vehicle-trips:read"),
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { isFailure } from "./result";
import { endVehicleTrip, startVehicleTrip } from "./vehicle-trips";

/**
 * RF-261 trip paths: idempotent retry + 24h freshness window.
 *
 * Same contract as RF-260: a known key converges on the live trip without
 * re-executing (no duplicate trip, no double photo upload); stale drafts are
 * rejected in Spanish before any write.
 */

const LIVE_TRIP = { id: "t1", vehicleId: "v1", startOdometer: 1000 };

function photo(): File {
  return new File(["bytes"], "odometro.jpg", { type: "image/jpeg" });
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
});

describe("startVehicleTrip offline retry", () => {
  it("replays a known idempotency key without creating a second trip", async () => {
    prismaMock.actionIdempotency.findUnique.mockResolvedValue({
      key: "key-trip-1",
      action: "startVehicleTrip",
      targetId: "t1",
    });
    const result = await startVehicleTrip(
      startForm({ idempotencyKey: "key-trip-1" }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe("t1");
    // No second trip: the create path (vehicle lookup) never ran.
    expect(prismaMock.vehicleTrip.findUnique).toHaveBeenCalledTimes(1);
  });

  it("rejects a stale draft in Spanish before any write", async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const result = await startVehicleTrip(
      startForm({ capturedAt: stale, idempotencyKey: "key-trip-stale" }),
    );
    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) expect(result.error).toMatch(/24 horas/);
    expect(prismaMock.actionIdempotency.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.vehicleTrip.findUnique).not.toHaveBeenCalled();
  });
});

describe("endVehicleTrip offline retry", () => {
  it("replays a known idempotency key without re-executing", async () => {
    prismaMock.actionIdempotency.findUnique.mockResolvedValue({
      key: "key-trip-end-1",
      action: "endVehicleTrip",
      targetId: "t1",
    });
    const result = await endVehicleTrip(
      endForm({ idempotencyKey: "key-trip-end-1" }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe("t1");
    expect(prismaMock.vehicleTrip.findUnique).toHaveBeenCalledTimes(1);
  });

  it("rejects a stale draft in Spanish before any write", async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const result = await endVehicleTrip(
      endForm({ capturedAt: stale, idempotencyKey: "key-trip-end-stale" }),
    );
    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) expect(result.error).toMatch(/24 horas/);
    expect(prismaMock.actionIdempotency.findUnique).not.toHaveBeenCalled();
  });
});
