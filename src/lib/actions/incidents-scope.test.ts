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
    schedule: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    userClientAssignment: { findFirst: vi.fn() },
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
  transactionWithNotifications: async (fn: (tx: unknown) => unknown) =>
    fn(prismaMock),
  notifyIncidentCreated: vi.fn(async () => undefined),
  notifyIncidentUpdated: vi.fn(async () => undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { BusinessRuleError } from "@/lib/actions/result";
import { notifyIncidentCreated } from "@/lib/notifications";
import {
  createIncident,
  createIncidentAsReporter,
  updateIncident,
  updateIncidentScheduledDate,
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
  requireClientAccess.mockResolvedValue(undefined);
  getPrimaryClientId.mockResolvedValue(C1);
  prismaMock.userClientAssignment.findFirst.mockResolvedValue({ clientId: C1 });
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
  prismaMock.schedule.findUnique.mockResolvedValue({
    clients: [{ clientId: C1 }],
    incidents: [{ clientId: C1 }],
  });
  prismaMock.schedule.create.mockResolvedValue({ id: S1 });
});

describe("createIncident scope (H-04)", () => {
  it("proves the Client is in scope before writing", async () => {
    await createIncident({ ...base, clientId: C1 });
    expect(requireClientAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" }),
      C1,
      prismaMock,
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
    expect(assertBelongsToClient).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: S1 }),
      C1,
      prismaMock,
    );
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
      prismaMock,
    );
    expect(prismaMock.incident.update).toHaveBeenCalled();
  });
  it("rejects an inactive or foreign schedule before updating", async () => {
    assertBelongsToClient.mockRejectedValueOnce(
      new BusinessRuleError("No encontrado."),
    );
    expect(
      await updateIncident(7, { ...base, clientId: C1, scheduleId: S1 }),
    ).toMatchObject({ success: false });
    expect(assertBelongsToClient).toHaveBeenCalledWith(
      { scheduleId: S1 },
      C1,
      prismaMock,
    );
    expect(prismaMock.incident.update).not.toHaveBeenCalled();
  });
  it("rejects scalar edits on cancelled incidents", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      clientId: C1,
      status: { code: "CANCELADA" },
    });
    expect((await updateIncident(7, { ...base, clientId: C1 })).success).toBe(
      false,
    );
    expect(prismaMock.incident.update).not.toHaveBeenCalled();
  });
});

describe("incident scheduled date", () => {
  it("requires schedule update permission on an existing schedule", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      clientId: C1,
      scheduleId: S1,
    });
    await updateIncidentScheduledDate(7, "2026-10-13T15:00:00Z");
    expect(requirePermission).toHaveBeenCalledWith("schedules:update");
    expect(prismaMock.schedule.update).toHaveBeenCalled();
  });
  it("rejects a shared schedule when a linked incident Client is inaccessible", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      clientId: C1,
      scheduleId: S1,
    });
    prismaMock.schedule.findUnique.mockResolvedValue({
      clients: [{ clientId: C1 }],
      incidents: [{ clientId: C1 }, { clientId: C2 }],
    });
    requireClientAccess.mockImplementation(
      async (_user?: unknown, clientId?: unknown) => {
        if (clientId === C2) throw new BusinessRuleError("Sin acceso.");
      },
    );
    expect(
      (await updateIncidentScheduledDate(7, "2026-10-13T15:00:00Z")).success,
    ).toBe(false);
    expect(requireClientAccess).toHaveBeenCalledWith(
      expect.anything(),
      C2,
      prismaMock,
    );
    expect(prismaMock.schedule.update).not.toHaveBeenCalled();
  });
  it("creates a dedicated linked schedule for a permitted single incident", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      clientId: C1,
      scheduleId: null,
      title: "Visit",
    });
    expect(
      (await updateIncidentScheduledDate(7, "2026-10-13T15:00:00Z")).success,
    ).toBe(true);
    expect(requirePermission).toHaveBeenCalledWith("schedules:create");
    expect(prismaMock.schedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clients: { create: { clientId: C1 } },
        }),
      }),
    );
  });
});

describe("createIncidentAsReporter scope (H-04)", () => {
  it("proves the line and equipment against the reporter's Client", async () => {
    await createIncidentAsReporter({ ...base, lineId: 3, equipmentId: 5 });
    expect(assertBelongsToClient).toHaveBeenCalledWith(
      { lineId: 3, equipmentId: 5 },
      C1,
      prismaMock,
    );
    expect(prismaMock.incident.create).toHaveBeenCalled();
  });
  it("reads the primary Client through the transaction", async () => {
    await createIncidentAsReporter(base);
    expect(prismaMock.userClientAssignment.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", isPrimary: true, active: true },
      select: { clientId: true },
    });
    expect(getPrimaryClientId).not.toHaveBeenCalled();
    expect(prismaMock.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "CREATED",
          actorId: "u1",
          payload: { source: "client" },
        }),
      }),
    );
    expect(
      prismaMock.incidentEvent.create.mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(notifyIncidentCreated).mock.invocationCallOrder[0],
    );
  });
  it("rejects a reporter whose primary Client is no longer active", async () => {
    prismaMock.userClientAssignment.findFirst.mockResolvedValue(null);
    expect((await createIncidentAsReporter(base)).success).toBe(false);
    expect(prismaMock.incident.create).not.toHaveBeenCalled();
    expect(notifyIncidentCreated).not.toHaveBeenCalled();
  });
});

it.each(["canonical", "reporter"])(
  "%s creation cannot notify when its audit write fails",
  async (flow) => {
    prismaMock.incidentEvent.create.mockRejectedValueOnce(
      new BusinessRuleError("No se pudo registrar el evento."),
    );
    const result =
      flow === "canonical"
        ? await createIncident({ ...base, clientId: C1 })
        : await createIncidentAsReporter(base);
    expect(result.success).toBe(false);
    expect(notifyIncidentCreated).not.toHaveBeenCalled();
  },
);
