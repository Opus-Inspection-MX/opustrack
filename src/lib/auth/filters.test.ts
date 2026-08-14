import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {},
}));

vi.mock("@/lib/utils/cliente-assignments", () => ({
  getUserClienteIds: vi.fn(),
}));

import {
  mergeRoles,
  type Role,
  SCOPE_ALL_CLIENTES,
  type UserWithPermissions,
} from "@/lib/authz/authz";
import { getUserClienteIds } from "@/lib/utils/cliente-assignments";
import {
  assertClienteAccess,
  canAccessCliente,
  canAccessClienteAsync,
  getClienteWhereClause,
  getClienteWhereClauseAsync,
  isAdmin,
} from "./filters";

const getIds = vi.mocked(getUserClienteIds);

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 2,
    name: "CLIENT",
    description: null,
    defaultPath: "/client",
    isSuperuser: false,
    priority: 10,
    permissions: [],
    ...overrides,
  };
}

function user(
  overrides: Partial<UserWithPermissions> = {},
): UserWithPermissions {
  return {
    id: "u1",
    email: "a@b.com",
    name: "Tester",
    clienteId: null,
    ...mergeRoles([role()]),
    ...overrides,
  };
}

/**
 * Cross-Cliente scope is a PERMISSION, not the role name.
 *
 * `ADMINISTRADOR` used to mean both "sees every center" and "may grant roles";
 * an operations admin needs the first without the second, so the two were
 * split. ROOT still gets it, implicitly, through `isSuperuser`.
 */
const admin = user({
  ...mergeRoles([
    role({
      id: 1,
      name: "ADMIN_OPERACION",
      defaultPath: "/admin/tracking",
      priority: 80,
      permissions: [
        {
          id: 99,
          name: SCOPE_ALL_CLIENTES,
          description: null,
          resource: "scope",
          action: "all-clientes",
          routePath: null,
          exact: false,
        },
      ],
    }),
  ]),
});

const root = user({
  ...mergeRoles([role({ id: 3, name: "ROOT", isSuperuser: true })]),
});

describe("isAdmin", () => {
  it("is true for anyone holding scope:all-clientes", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(user())).toBe(false);
  });

  it("is true for ROOT without the permission being seeded", () => {
    expect(isAdmin(root)).toBe(true);
  });
});

describe("getClienteWhereClause (sync)", () => {
  it("returns an empty filter for admins (sees everything)", () => {
    expect(getClienteWhereClause(admin)).toEqual({});
  });

  it("filters by null Cliente for users without a Cliente", () => {
    expect(getClienteWhereClause(user({ clienteId: null }))).toEqual({
      clienteId: { equals: null },
    });
  });

  it("filters by the user's assigned Cliente", () => {
    expect(getClienteWhereClause(user({ clienteId: "c1" }))).toEqual({
      clienteId: "c1",
    });
  });
});

describe("canAccessCliente (sync)", () => {
  it("lets admins access any Cliente", () => {
    expect(canAccessCliente(admin, "c1")).toBe(true);
    expect(canAccessCliente(admin, null)).toBe(true);
  });

  it("lets Cliente-less users access only null-Cliente data", () => {
    const u = user({ clienteId: null });
    expect(canAccessCliente(u, null)).toBe(true);
    expect(canAccessCliente(u, "c1")).toBe(false);
  });

  it("lets users access only their own Cliente", () => {
    const u = user({ clienteId: "c1" });
    expect(canAccessCliente(u, "c1")).toBe(true);
    expect(canAccessCliente(u, "c2")).toBe(false);
  });
});

describe("assertClienteAccess", () => {
  it("does not throw when access is allowed", () => {
    expect(() =>
      assertClienteAccess(user({ clienteId: "c1" }), "c1"),
    ).not.toThrow();
  });

  it("throws when access is denied", () => {
    expect(() => assertClienteAccess(user({ clienteId: "c1" }), "c2")).toThrow(
      /Access denied/,
    );
  });
});

describe("getClienteWhereClauseAsync (multi-Cliente)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty filter for admins without querying assignments", async () => {
    expect(await getClienteWhereClauseAsync(admin)).toEqual({});
    expect(getIds).not.toHaveBeenCalled();
  });

  it("uses a direct filter for a single assigned Cliente", async () => {
    getIds.mockResolvedValue(["c1"]);
    expect(await getClienteWhereClauseAsync(user())).toEqual({
      clienteId: "c1",
    });
  });

  it("uses an IN filter for multiple assigned Clientes", async () => {
    getIds.mockResolvedValue(["c1", "c2"]);
    expect(await getClienteWhereClauseAsync(user())).toEqual({
      clienteId: { in: ["c1", "c2"] },
    });
  });

  it("falls back to legacy clienteId when no assignments exist", async () => {
    getIds.mockResolvedValue([]);
    expect(
      await getClienteWhereClauseAsync(user({ clienteId: "legacy" })),
    ).toEqual({ clienteId: "legacy" });
  });

  it("filters by null Cliente when there are no assignments and no legacy id", async () => {
    getIds.mockResolvedValue([]);
    expect(await getClienteWhereClauseAsync(user({ clienteId: null }))).toEqual(
      {
        clienteId: { equals: null },
      },
    );
  });
});

describe("canAccessClienteAsync (multi-Cliente)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets admins access any Cliente", async () => {
    expect(await canAccessClienteAsync(admin, "c1")).toBe(true);
  });

  it("grants access when the Cliente is in the user's assignments", async () => {
    getIds.mockResolvedValue(["c1", "c2"]);
    expect(await canAccessClienteAsync(user(), "c2")).toBe(true);
  });

  it("falls back to legacy clienteId when not in assignments", async () => {
    getIds.mockResolvedValue(["c1"]);
    expect(await canAccessClienteAsync(user({ clienteId: "c9" }), "c9")).toBe(
      true,
    );
  });

  it("denies access to an unrelated Cliente", async () => {
    getIds.mockResolvedValue(["c1"]);
    expect(await canAccessClienteAsync(user({ clienteId: "c1" }), "c2")).toBe(
      false,
    );
  });

  it("allows null-Cliente data only for fully Cliente-less users", async () => {
    getIds.mockResolvedValue([]);
    expect(await canAccessClienteAsync(user({ clienteId: null }), null)).toBe(
      true,
    );
    getIds.mockResolvedValue([]);
    expect(await canAccessClienteAsync(user({ clienteId: "c1" }), null)).toBe(
      false,
    );
  });
});
