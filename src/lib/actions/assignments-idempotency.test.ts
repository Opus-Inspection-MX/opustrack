import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txRunner } = vi.hoisted(() => ({
  prismaMock: {
    actionIdempotency: { findUnique: vi.fn() },
    assignment: { findUnique: vi.fn(), findFirst: vi.fn() },
    userClientAssignment: { findMany: vi.fn() },
    user: { count: vi.fn() },
  },
  txRunner: { fn: vi.fn() },
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requireAuth: async () => ({
    id: "fsr-1",
    isSuperuser: false,
    permissions: new Set(),
  }),
  requirePermission: async () => ({
    id: "fsr-1",
    isSuperuser: false,
    permissions: new Set(),
  }),
}));
vi.mock("@/lib/notifications/after-commit", () => ({
  transactionWithNotifications: (fn: unknown) => txRunner.fn(fn),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { closeAssignment, startAssignmentWork } from "./assignments";

/**
 * Fase 5b (H-13): `startAssignmentWork` / `closeAssignment` converge when the
 * idempotency claim loses the race INSIDE the transaction.
 *
 * A P2002 aborts the transaction; convergence then validates the winner's
 * binding and the caller's current worker access before returning its row.
 */

const LIVE = {
  id: "a1",
  incidentId: "i1",
  incident: { clientId: "c1" },
  assignees: [{ userId: "fsr-1" }],
};

function workForm(key: string): FormData {
  const fd = new FormData();
  fd.append("assignmentId", "a1");
  fd.append("latitude", "19.43");
  fd.append("longitude", "-99.13");
  fd.append("idempotencyKey", key);
  return fd;
}

function closeForm(key: string): FormData {
  const fd = new FormData();
  fd.append("assignmentId", "a1");
  fd.append("latitude", "19.43");
  fd.append("longitude", "-99.13");
  fd.append("idempotencyKey", key);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Sequential retries converge before the transaction; the race under test
  // loses INSIDE it: the pre-transaction lookup misses, the converge lookup
  // finds the winner.
  prismaMock.actionIdempotency.findUnique.mockResolvedValue({
    key: "key-5b",
    action: "startAssignmentWork",
    actorId: "fsr-1",
    requestTargetId: "a1",
    targetId: "a1",
  });
  prismaMock.actionIdempotency.findUnique.mockResolvedValueOnce(null);
  txRunner.fn.mockRejectedValue({ code: "P2002" });
  // The winner's row, reloaded for convergence.
  prismaMock.assignment.findUnique.mockResolvedValue(LIVE);
  prismaMock.assignment.findFirst.mockResolvedValue(LIVE);
  prismaMock.userClientAssignment.findMany.mockResolvedValue([
    { clientId: "c1" },
  ]);
  prismaMock.user.count.mockResolvedValue(0);
});

describe("assignment idempotency converge on P2002", () => {
  it("startAssignmentWork devuelve la fila viva en vez de un error genérico", async () => {
    const result = await startAssignmentWork(workForm("key-5b-start"));

    expect(result.success).toBe(true);
    if (result.success) expect((result.data as { id: string }).id).toBe("a1");
  });

  it("closeAssignment devuelve la fila viva en vez de un error genérico", async () => {
    prismaMock.actionIdempotency.findUnique.mockResolvedValue({
      actorId: "fsr-1",
      action: "closeAssignment",
      requestTargetId: "a1",
      targetId: "a1",
    });
    const result = await closeAssignment(closeForm("key-5b-close"));

    expect(result.success).toBe(true);
    if (result.success) expect((result.data as { id: string }).id).toBe("a1");
  });
});

describe.each([
  ["startAssignmentWork", startAssignmentWork, workForm],
  ["closeAssignment", closeAssignment, closeForm],
] as const)("%s P2002 convergence authorization", (action, run, form) => {
  it.each([
    { actorId: "fsr-2" },
    { action: "otherAction" },
    { requestTargetId: "a2" },
    { actorId: null },
  ])(
    "rejects a concurrent winner with another binding (%j)",
    async (override) => {
      prismaMock.actionIdempotency.findUnique.mockResolvedValue({
        actorId: "fsr-1",
        action,
        requestTargetId: "a1",
        targetId: "a1",
        ...override,
      });
      expect(await run(form("race-key"))).toMatchObject({
        success: false,
        error: expect.stringMatching(/llave de reintento/),
      });
      expect(txRunner.fn).toHaveBeenCalledTimes(1);
      expect(prismaMock.assignment.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.assignment.findUnique).not.toHaveBeenCalled();
    },
  );

  it("rejects the actual winner row when worker access has been revoked", async () => {
    prismaMock.actionIdempotency.findUnique.mockResolvedValue({
      actorId: "fsr-1",
      action,
      requestTargetId: "a1",
      targetId: "a1",
    });
    prismaMock.assignment.findFirst.mockResolvedValue({
      ...LIVE,
      assignees: [{ userId: "fsr-2" }],
    });
    expect(await run(form("race-key"))).toMatchObject({
      success: false,
      error: expect.stringMatching(/FSR asignado/),
    });
    expect(txRunner.fn).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.assignment.findUnique).not.toHaveBeenCalled();
  });
});
