import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Scope wiring of the single-incident writes (Fase 0c, H-04).
 *
 * The loader logic itself lives in `auth/access.test.ts`; what is pinned
 * here is that the actions actually CALL it, with the right arguments:
 *
 * - `createIncident` refuses a Client outside the caller's scope, proves the
 *   schedule belongs to that Client, and only honors `reportedById` for a
 *   scope holder (otherwise the reporter is whoever files it);
 * - `updateIncident` proves the NEW Client, not just the current one;
 * - `createIncidentAsReporter` proves the line/equipment against the
 *   reporter's own Client.
 */

const {
  prismaMock,
  requirePermission,
  requireClientAccess,
  assertBelongsToClient,
  getPrimaryClientId,
} = vi.hoisted(() => ({
  prismaMock: {
    incident: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    incidentStatus: { findUnique: vi.fn(), findFirst: vi.fn() },
    incidentType: { findUnique: vi.fn() },
    incidentAssignee: { createMany: vi.fn(), findMany: vi.fn() },
    incidentEvent: { create: vi.fn() },
  },
  requirePermission: vi.fn(async (_name: string) => ({
    id: "u1",
    isSuperuser: false,
    permissions: new Set<string>(),
  })),
  requireClientAccess: vi.fn(async () => undefined),
  assertBelongsToClient: vi.fn(async () => undefined),
  getPrimaryClientId: vi.fn(async (_userId: string) => C1),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/auth/access", () => ({
  requireClientAccess: (...args: unknown[]) =>
    (requireClientAccess as (...a: unknown[]) => unknown)(...args),
  assertBelongsToClient: (...args: unknown[]) =>
    (assertBelongsToClient as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@/lib/auth/filters", () => ({
  assertClientAccessAsync: vi.fn(async () => undefined),
}));
vi.mock("@/lib/utils/client-assignments", () => ({
  getPrimaryClientId: (id: string) => getPrimaryClientId(id),
}));
vi.mock("@/lib/notifications", () => ({
  notifyIncidentCreated: vi.fn(async () => undefined),
  notifyIncidentUpdated: vi.fn(async () => undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { BusinessRuleError } from "@/lib/actions/result";
import {
  createIncident,
  createIncidentAsReporter,
  updateIncident,
} from "./incidents";

const base = {
  title: "Fuga en línea 3",
  description: "Se detectó una fuga durante la inspección",
  typeId: 1,
};

// Valid cuids (zod-checked): the scope assertions compare them opaquely.
const C1 = "ckabc123def456ghi789jkl01";
const C2 = "ckxyz987uvw654rst321opq02";
const S1 = "cksched111aaa222bbb333ccc";

beforeEach(() => {
  vi.clearAllMocks();
  getPrimaryClientId.mockResolvedValue(C1);
  prismaMock.incidentStatus.findUnique.mockResolvedValue({ id: 10 });
  prismaMock.incidentStatus.findFirst.mockResolvedValue({ id: 10 });
  prismaMock.incidentType.findUnique.mockResolvedValue({ id: 1 });
  prismaMock.incident.findUnique.mockResolvedValue({ clientId: C1 });
  prismaMock.incident.create.mockImplementation(async ({ data }: never) => ({
    id: 7,
    ...(data as object),
  }));
  prismaMock.incident.update.mockImplementation(async ({ data }: never) => ({
    id: 7,
    ...(data as object),
  }));
  prismaMock.incidentAssignee.findMany.mockResolvedValue([]);
  prismaMock.incidentEvent.create.mockResolvedValue({});
});

describe("createIncident scope (H-04)", () => {
  it("proves the Client is in scope before writing", async () => {
    await createIncident({ ...base, clientId: C1 });
    expect(requireClientAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" }),
      C1,
    );
    expect(prismaMock.incident.create).toHaveBeenCalled();
  });

  it("returns the denial instead of writing when out of scope", async () => {
    requireClientAccess.mockRejectedValueOnce(
      new BusinessRuleError("Sin acceso a los datos de este Cliente."),
    );
    const result = await createIncident({ ...base, clientId: C2 });
    expect(result).toEqual({
      success: false,
      error: "Sin acceso a los datos de este Cliente.",
    });
    expect(prismaMock.incident.create).not.toHaveBeenCalled();
  });

  it("proves the schedule belongs to the incident Client", async () => {
    await createIncident({ ...base, clientId: C1, scheduleId: S1 });
    expect(assertBelongsToClient).toHaveBeenCalledWith({ scheduleId: S1 }, C1);
  });

  it("files under the caller unless they hold the cross-Client scope", async () => {
    // Scoped caller: reportedById is ignored, no impersonation.
    const scoped = await createIncident({
      ...base,
      clientId: C1,
      reportedById: C2,
    });
    expect(scoped.success).toBe(true);
    expect(prismaMock.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reportedById: "u1" }),
      }),
    );
  });

  it("honors reportedById for a scope holder", async () => {
    requirePermission.mockResolvedValueOnce({
      id: "admin",
      isSuperuser: false,
      permissions: new Set(["scope:all-clients"]),
    });
    await createIncident({
      ...base,
      clientId: C1,
      reportedById: C2,
    });
    expect(prismaMock.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reportedById: C2 }),
      }),
    );
  });
});

describe("updateIncident scope (H-04)", () => {
  it("proves the NEW Client, not just the current one", async () => {
    await updateIncident(7, { ...base, clientId: C2 });
    expect(requireClientAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" }),
      C2,
    );
    expect(prismaMock.incident.update).toHaveBeenCalled();
  });
});

describe("createIncidentAsReporter scope (H-04)", () => {
  it("proves the line and equipment against the reporter's Client", async () => {
    await createIncidentAsReporter({ ...base, lineId: 3, equipmentId: 5 });
    expect(assertBelongsToClient).toHaveBeenCalledWith(
      { lineId: 3, equipmentId: 5 },
      C1,
    );
    expect(prismaMock.incident.create).toHaveBeenCalled();
  });
});
