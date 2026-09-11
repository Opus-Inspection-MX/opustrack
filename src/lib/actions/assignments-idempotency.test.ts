import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txRunner } = vi.hoisted(() => ({
  prismaMock: {
    actionIdempotency: { findUnique: vi.fn() },
    assignment: { findUnique: vi.fn() },
  },
  txRunner: { fn: vi.fn() },
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requireAuth: async () => ({ id: "fsr-1" }),
  requirePermission: async () => ({ id: "fsr-1" }),
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
 * Today the pre-transaction lookup converges sequential retries, but a P2002
 * from the in-transaction claim aborts the whole Postgres transaction and
 * surfaces a generic error. The retry must answer with the live row instead.
 *
 * TODO(int): promote to concurrency.int.test.ts once Fase 2 infra lands.
 */

const LIVE = { id: "a1", incidentId: "i1" };

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
    targetId: "a1",
  });
  prismaMock.actionIdempotency.findUnique.mockResolvedValueOnce(null);
  txRunner.fn.mockRejectedValue({ code: "P2002" });
  // The winner's row, reloaded for convergence.
  prismaMock.assignment.findUnique.mockResolvedValue(LIVE);
});

describe("assignment idempotency converge on P2002", () => {
  it("startAssignmentWork devuelve la fila viva en vez de un error genérico", async () => {
    const result = await startAssignmentWork(workForm("key-5b-start"));

    expect(result.success).toBe(true);
    if (result.success)
      expect((result.data as { id: string }).id).toBe("a1");
  });

  it("closeAssignment devuelve la fila viva en vez de un error genérico", async () => {
    const result = await closeAssignment(closeForm("key-5b-close"));

    expect(result.success).toBe(true);
    if (result.success)
      expect((result.data as { id: string }).id).toBe("a1");
  });
});
