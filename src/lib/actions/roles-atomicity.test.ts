import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock, invalidateRoleSessions } = vi.hoisted(() => ({
  txMock: {
    role: { update: vi.fn() },
    rolePermission: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
  prismaMock: {
    role: { findUnique: vi.fn(), update: vi.fn() },
    rolePermission: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  invalidateRoleSessions: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: async () => ({ id: "admin-1" }),
}));
vi.mock("@/lib/authz/role-assignment", () => ({
  assertCanManageRoles: vi.fn(),
}));
vi.mock("@/lib/auth/session-management", () => ({
  invalidateRoleSessions: (...args: unknown[]) =>
    invalidateRoleSessions(...args),
}));
vi.mock("@/lib/authz/authz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authz/authz")>();
  return { ...actual, clearPermissionsCache: vi.fn() };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { assignPermissionsToRole, updateRole } from "./roles";

/**
 * Fase 5c (H-15): role edits are atomic and session-safe.
 *
 * `updateRole` runs role + permission writes in ONE transaction, toggles
 * `RolePermission.active` (soft delete per convention — never
 * `deleteMany`/`createMany` from scratch), and bumps sessions when grants
 * or `defaultPath` change. `assignPermissionsToRole` shares the same
 * internal sync.
 */

const CALLER_DATA = {
  name: "Operaciones",
  description: "",
  defaultPath: "/admin",
  permissionIds: [1, 2],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
    (cb as (tx: unknown) => Promise<unknown>)(txMock),
  );
  prismaMock.role.findUnique.mockResolvedValue({
    id: 5,
    defaultPath: "/admin",
    rolePermission: [{ permissionId: 1 }],
  });
  txMock.role.update.mockResolvedValue({ id: 5 });
  txMock.rolePermission.findMany.mockResolvedValue([
    { permissionId: 1, active: true },
  ]);
  txMock.rolePermission.updateMany.mockResolvedValue({ count: 0 });
  txMock.rolePermission.createMany.mockResolvedValue({ count: 1 });
});

describe("updateRole atomicity", () => {
  it("corre rol + permisos en una sola transacción", async () => {
    await updateRole(5, CALLER_DATA);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.role.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } }),
    );
  });

  it("sincroniza permisos con soft-delete, nunca deleteMany", async () => {
    await updateRole(5, CALLER_DATA);

    expect(txMock.rolePermission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roleId: 5 }),
      }),
    );
    // Permission 1 stays (no write), 2 is brand new (createMany).
    expect(txMock.rolePermission.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ permissionId: { in: [1] } }),
      }),
    );
    expect(txMock.rolePermission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ roleId: 5, permissionId: 2 }),
        ]),
      }),
    );
    expect(prismaMock.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(txMock.rolePermission.createMany.mock.calls[0][0].data).toHaveLength(
      1,
    );
  });

  it("reactiva una fila desactivada en vez de crear duplicados", async () => {
    txMock.rolePermission.findMany.mockResolvedValue([
      { permissionId: 1, active: true },
      { permissionId: 2, active: false },
    ]);

    await updateRole(5, CALLER_DATA);

    expect(txMock.rolePermission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roleId: 5,
          permissionId: { in: [2] },
        }),
        data: expect.objectContaining({ active: true }),
      }),
    );
    expect(txMock.rolePermission.createMany).not.toHaveBeenCalled();
  });

  it("desactiva con soft-delete los permisos retirados", async () => {
    await updateRole(5, { ...CALLER_DATA, permissionIds: [] });

    expect(txMock.rolePermission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ active: false }),
      }),
    );
    expect(prismaMock.rolePermission.deleteMany).not.toHaveBeenCalled();
  });

  it("invalida sesiones cuando cambian permisos o defaultPath", async () => {
    await updateRole(5, CALLER_DATA);

    expect(invalidateRoleSessions).toHaveBeenCalledWith(5);
  });

  it("no invalida sesiones cuando nada cambió", async () => {
    await updateRole(5, {
      name: "Operaciones",
      description: "",
      defaultPath: "/admin",
      permissionIds: [1],
    });

    expect(txMock.rolePermission.createMany).not.toHaveBeenCalled();
    expect(txMock.rolePermission.updateMany).not.toHaveBeenCalled();
    expect(invalidateRoleSessions).not.toHaveBeenCalled();
  });
});

describe("assignPermissionsToRole", () => {
  it("usa el mismo sync con soft-delete dentro de una transacción", async () => {
    prismaMock.role.findUnique.mockResolvedValue({
      id: 5,
      defaultPath: "/admin",
      rolePermission: [{ permissionId: 1 }],
    });

    await assignPermissionsToRole(5, [1, 2]);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(invalidateRoleSessions).toHaveBeenCalledWith(5);
  });
});
