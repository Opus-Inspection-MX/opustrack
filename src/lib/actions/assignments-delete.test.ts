import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermission } = vi.hoisted(() => ({
  prismaMock: {
    assignment: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  requirePermission: vi.fn(async (_name: string) => ({ id: "u1" })),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const REDIRECT = "NEXT_REDIRECT";
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT}:${path}`);
  },
}));

import { deleteAssignment } from "./assignments";

/**
 * RF-250 · deleting an assignment must not orphan cost records.
 *
 * Recorded parts carry prices — they are what gets billed and audited — so an
 * assignment with active items refuses deletion like one with active
 * activities or attachments already did.
 */

function row(overrides = {}) {
  return {
    incidentId: 1,
    _count: { assignmentActivities: 0, attachments: 0, items: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.assignment.findUnique.mockResolvedValue(row());
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(prismaMock),
  );
});

describe("deleteAssignment · guardas (RF-250)", () => {
  it("rechaza cuando hay partes activas y no escribe", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue(
      row({ _count: { assignmentActivities: 0, attachments: 0, items: 2 } }),
    );

    const result = await deleteAssignment("a1");

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/2 parte\(s\)/),
    });
    expect(prismaMock.assignment.update).not.toHaveBeenCalled();
  });

  it("elimina cuando no hay hijos activos", async () => {
    await expect(deleteAssignment("a1")).rejects.toThrow(new RegExp(REDIRECT));

    expect(prismaMock.assignment.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { active: false },
    });
  });
});
