import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermission } = vi.hoisted(() => ({
  prismaMock: {
    actionIdempotency: { findUnique: vi.fn() },
    assignment: { findUnique: vi.fn(), findFirst: vi.fn() },
    userClientAssignment: { findMany: vi.fn() },
    user: { count: vi.fn() },
    $transaction: vi.fn(),
  },
  requirePermission: vi.fn(async (_name: string) => ({
    id: "fsr-1",
    isSuperuser: false,
    permissions: new Set(),
  })),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { loggerErrorMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
}));

// El caso "falls through" dispara a propósito el camino de defecto de
// guarded(), que loguea action.defect antes de relanzar. Se mockea el logger
// para que ese ERROR esperado no ensucie el stderr del CI (mismo patrón que
// auth-split.test.ts).
vi.mock("@/lib/observability/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock,
  },
}));

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
  incident: { title: "Fuga", clientId: "c1" },
  assignees: [{ userId: "fsr-1" }],
  status: { name: "CERRADO" },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.actionIdempotency.findUnique.mockResolvedValue(null);
  prismaMock.assignment.findUnique.mockResolvedValue(LIVE);
  prismaMock.assignment.findFirst.mockResolvedValue(LIVE);
  prismaMock.userClientAssignment.findMany.mockResolvedValue([
    { clientId: "c1" },
  ]);
  prismaMock.user.count.mockResolvedValue(0);
});

describe("closeAssignment offline retry", () => {
  it("replays a known idempotency key without re-executing", async () => {
    prismaMock.actionIdempotency.findUnique.mockResolvedValue({
      key: "key-1",
      action: "closeAssignment",
      actorId: "fsr-1",
      requestTargetId: "a1",
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
    // El defecto se logueó antes de relanzar (contrato de guarded()).
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "action.defect",
      expect.anything(),
    );
  });
});

describe("startAssignmentWork offline retry", () => {
  it("replays a known idempotency key without re-executing", async () => {
    prismaMock.actionIdempotency.findUnique.mockResolvedValue({
      key: "key-start-1",
      action: "startAssignmentWork",
      actorId: "fsr-1",
      requestTargetId: "a1",
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

describe.each([
  ["startAssignmentWork", startAssignmentWork],
  ["closeAssignment", closeAssignment],
] as const)("%s replay authorization", (action, run) => {
  const replay = () => ({
    actorId: "fsr-1",
    action,
    requestTargetId: "a1",
    targetId: "a1",
  });

  it.each([
    { actorId: "fsr-2" },
    { action: "otherAction" },
    { requestTargetId: "a2" },
    { actorId: null },
  ])(
    "rejects a key with a different binding (%j) before loading a row",
    async (override) => {
      prismaMock.actionIdempotency.findUnique.mockResolvedValue({
        ...replay(),
        ...override,
      });
      expect(
        await run(closeForm({ idempotencyKey: "key-bound" })),
      ).toMatchObject({
        success: false,
        error: expect.stringMatching(/llave de reintento/),
      });
      expect(prismaMock.assignment.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.assignment.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(["assignee", "Cliente", "deleted"])(
    "rejects replay after %s access is revoked",
    async (revocation) => {
      prismaMock.actionIdempotency.findUnique.mockResolvedValue(replay());
      if (revocation === "assignee")
        prismaMock.assignment.findFirst.mockResolvedValue({
          ...LIVE,
          assignees: [{ userId: "fsr-2" }],
        });
      if (revocation === "Cliente")
        prismaMock.userClientAssignment.findMany.mockResolvedValue([]);
      if (revocation === "deleted")
        prismaMock.assignment.findFirst.mockResolvedValue(null);
      expect(
        await run(closeForm({ idempotencyKey: "key-bound" })),
      ).toMatchObject({ success: false });
      expect(prismaMock.assignment.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.assignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "a1", active: true, incident: { active: true } },
        }),
      );
    },
  );
});
