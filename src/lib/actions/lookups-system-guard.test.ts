import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fase 3 (H-08): a coded (system) state row cannot be deactivated, and a
 * renamed system role keeps working because resolution is by code.
 * Mock-based by design (no database): the same guarantees run against real
 * Postgres in `src/test/integration/`.
 */

const { prismaMock, txMock, requirePermissionMock } = vi.hoisted(() => ({
  prismaMock: {
    incidentStatus: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    incident: { count: vi.fn() },
    role: { findUnique: vi.fn(), update: vi.fn() },
    rolePermission: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
  txMock: { role: { update: vi.fn() } },
  requirePermissionMock: vi.fn(async (_name: string) => ({ id: "admin" })),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermissionMock(name),
}));
vi.mock("@/lib/authz/authz", () => ({ clearPermissionsCache: vi.fn() }));
vi.mock("@/lib/authz/role-assignment", () => ({
  assertCanManageRoles: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

import { deleteIncidentStatus } from "@/lib/actions/lookups";
import { isFailure } from "@/lib/actions/result";
import { updateRole } from "@/lib/actions/roles";
import { ROLE } from "@/lib/authz/roles";
import { whereHasRole } from "@/lib/authz/user-queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("system state guard", () => {
  it("rejects deactivating a coded row even when its label was renamed", async () => {
    prismaMock.incidentStatus.findUnique.mockResolvedValue({
      code: "CERRADO",
      name: "Closed-renamed",
    });

    const result = await deleteIncidentStatus(9);

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error).toBe(
        "No se puede desactivar un estado del sistema.",
      );
    }
    expect(prismaMock.incident.count).not.toHaveBeenCalled();
    expect(prismaMock.incidentStatus.update).not.toHaveBeenCalled();
  });

  it("lets custom rows (no code) through to the child guard", async () => {
    prismaMock.incidentStatus.findUnique.mockResolvedValue({
      code: null,
      name: "CUSTOM",
    });
    prismaMock.incident.count.mockResolvedValue(0);
    prismaMock.incidentStatus.update.mockResolvedValue({ id: 7 });

    await expect(deleteIncidentStatus(7)).rejects.toThrow("NEXT_REDIRECT");

    expect(prismaMock.incident.count).toHaveBeenCalled();
    expect(prismaMock.incidentStatus.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { active: false },
    });
  });
});

describe("renaming the FSR role", () => {
  it("updateRole edits the label without touching the code", async () => {
    // updateRole reads the previous row, then writes inside ONE transaction
    // (Fase 5c): the update itself runs on the tx client, never bare.
    prismaMock.role.findUnique.mockResolvedValue({
      id: 4,
      defaultPath: "/fsr",
      priority: 50,
      rolePermission: [],
    });
    prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: unknown) => Promise<unknown>)(txMock),
    );
    txMock.role.update.mockResolvedValue({ id: 4 });

    const result = await updateRole(4, {
      name: "Field-renamed",
      description: "techs",
      defaultPath: "/fsr",
      priority: 50,
    });

    expect(isFailure(result)).toBe(false);
    // The coded identity is never written: only the label moves.
    expect(txMock.role.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: {
        name: "Field-renamed",
        description: "techs",
        defaultPath: "/fsr",
        priority: 50,
      },
    });
  });

  it("FSR resolution still matches by code after the rename", () => {
    // The renamed row keeps code FSR, so the first OR branch matches —
    // tech lists, assertAssigneesAreFsrs and updateClient keep working.
    expect(whereHasRole(ROLE.FSR)).toEqual({
      userRoles: {
        some: {
          active: true,
          role: {
            active: true,
            OR: [{ code: "FSR" }, { code: null, name: "FSR" }],
          },
        },
      },
    });
  });
});
