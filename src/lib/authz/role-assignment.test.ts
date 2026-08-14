import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    role: { findMany: vi.fn() },
    userRole: { updateMany: vi.fn(), upsert: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));

import { mergeRoles, type Role } from "./authz";
import { assertCanManageRoles, setUserRoles } from "./role-assignment";

/**
 * The privilege-escalation boundary.
 *
 * Granting a role is the one operation that can create more power than the
 * caller holds, so it is gated on `isSuperuser` rather than on a permission —
 * an administrator who can grant themselves the permission that grants
 * permissions is not an administrator, it is a second root. These tests are the
 * proof that the gate is on the server, not only missing from the UI.
 */

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 1,
    name: "ADMIN_VACACIONES",
    description: null,
    defaultPath: "/admin/vacations",
    isSuperuser: false,
    priority: 70,
    permissions: [],
    ...overrides,
  };
}

const rootCaller = {
  id: "root-1",
  ...mergeRoles([role({ id: 3, name: "ROOT", isSuperuser: true })]),
};
const moduleAdmin = { id: "va-1", ...mergeRoles([role()]) };

/** The message a module admin must see — Spanish, and therefore returned. */
const REFUSAL = /Solo un usuario ROOT/;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.role.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(prismaMock),
  );
});

describe("assertCanManageRoles", () => {
  it("deja pasar a ROOT", () => {
    expect(() => assertCanManageRoles(rootCaller)).not.toThrow();
  });

  it("rechaza a un admin de módulo", () => {
    expect(() => assertCanManageRoles(moduleAdmin)).toThrow(REFUSAL);
  });
});

describe("setUserRoles", () => {
  it("ROOT reemplaza los roles y fuerza el re-login", async () => {
    await setUserRoles(rootCaller, "u1", [1, 2]);

    // Roles not in the list are deactivated, not deleted: re-granting a role
    // must reuse its row instead of piling up duplicates.
    expect(prismaMock.userRole.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", roleId: { notIn: [1, 2] } },
      data: { active: false },
    });
    expect(prismaMock.userRole.upsert).toHaveBeenCalledTimes(2);

    // Route grants ride in the JWT, so without this bump the person keeps the
    // old menu and the old access until the token expires.
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { sessionVersion: { increment: 1 } },
    });
  });

  it("un admin de vacaciones NO puede darse el rol de operación", async () => {
    await expect(setUserRoles(moduleAdmin, "otro", [1, 2])).rejects.toThrow(
      REFUSAL,
    );

    expect(prismaMock.userRole.upsert).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("nadie edita sus propios roles, ni ROOT", async () => {
    await expect(setUserRoles(rootCaller, rootCaller.id, [1])).rejects.toThrow(
      /tus propios roles/,
    );

    expect(prismaMock.userRole.upsert).not.toHaveBeenCalled();
  });

  it("exige al menos un rol", async () => {
    // Zero roles cannot authenticate at all, which looks like a broken account
    // rather than a revoked one. Deactivating the user is the way to do that.
    await expect(setUserRoles(rootCaller, "u1", [])).rejects.toThrow(
      /al menos un rol/,
    );
  });

  it("rechaza roles inexistentes o inactivos", async () => {
    prismaMock.role.findMany.mockResolvedValue([{ id: 1 }]);

    await expect(setUserRoles(rootCaller, "u1", [1, 999])).rejects.toThrow(
      /no existen o están inactivos/,
    );
    expect(prismaMock.userRole.upsert).not.toHaveBeenCalled();
  });

  it("deduplica antes de escribir", async () => {
    await setUserRoles(rootCaller, "u1", [1, 1, 2, 2]);

    expect(prismaMock.userRole.upsert).toHaveBeenCalledTimes(2);
  });
});
