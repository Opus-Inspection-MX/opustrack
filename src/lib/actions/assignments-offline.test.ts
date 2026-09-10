import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermission } = vi.hoisted(() => ({
  prismaMock: {
    actionIdempotency: { findUnique: vi.fn() },
    assignment: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  requirePermission: vi.fn(async (_name: string) => ({ id: "fsr-1" })),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { closeAssignment, startAssignmentWork } from "./assignments";
import { isFailure } from "./result";

/**
 * RF-260 start/close paths: idempotent retry + 24h freshness window.
 *
 * A retried action with a known key converges on the live row without
 * re-executing the transition; a stale draft is rejected in Spanish before
 * any write; online callers without the new params are untouched.
 */

function closeForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("assignmentId", "a1");
  fd.append("latitude", "19.43");
  fd.append("longitude", "-99.13");
  for (const [k, v] of Object.entries(overrides)) fd.append(k, v);
  return fd;
}

const LIVE = {
  id: "a1",
  incidentId: 7,
  incident: { title: "Fuga" },
  assignees: [],
  status: { name: "CERRADO" },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.actionIdempotency.findUnique.mockResolvedValue(null);
  prismaMock.assignment.findUnique.mockResolvedValue(LIVE);
});

describe("closeAssignment offline retry", () => {
  it("replays a known idempotency key without re-executing", async () => {
    prismaMock.actionIdempotency.findUnique.mockResolvedValue({
      key: "key-1",
      action: "closeAssignment",
      targetId: "a1",
    });
    const result = await closeAssignment(
      closeForm({ idempotencyKey: "key-1" }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe("a1");
    // The transition never ran: no transaction, no second close.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a stale draft in Spanish before any write", async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const result = await closeAssignment(
      closeForm({ capturedAt: stale, idempotencyKey: "key-stale" }),
    );
    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) expect(result.error).toMatch(/24 horas/);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.assignment.findUnique).not.toHaveBeenCalled();
  });

  it("falls through to the transition for unknown keys", async () => {
    prismaMock.$transaction.mockImplementation(async () => {
      throw new Error("stop-before-guards");
    });
    await expect(
      closeAssignment(closeForm({ idempotencyKey: "key-new" })),
    ).rejects.toThrow("stop-before-guards");
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("startAssignmentWork offline retry", () => {
  it("replays a known idempotency key without re-executing", async () => {
    prismaMock.actionIdempotency.findUnique.mockResolvedValue({
      key: "key-start-1",
      action: "startAssignmentWork",
      targetId: "a1",
    });
    const result = await startAssignmentWork(
      closeForm({ idempotencyKey: "key-start-1" }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe("a1");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a stale draft in Spanish before any write", async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const result = await startAssignmentWork(
      closeForm({ capturedAt: stale, idempotencyKey: "key-start-stale" }),
    );
    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) expect(result.error).toMatch(/24 horas/);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
