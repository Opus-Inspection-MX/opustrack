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
  assertClienteAccessAsync,
  canAccessClienteAsync,
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

describe("assertClienteAccessAsync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not throw when access is allowed", async () => {
    getIds.mockResolvedValue(["c1"]);
    await expect(
      assertClienteAccessAsync(user(), "c1"),
    ).resolves.toBeUndefined();
  });

  it("raises a business rule when access is denied", async () => {
    getIds.mockResolvedValue(["c1"]);
    // Operator-facing denial: `guarded()` turns this into a returned
    // rejection instead of a production-invisible throw.
    await expect(assertClienteAccessAsync(user(), "c2")).rejects.toThrow(
      /Sin acceso a los datos de este Cliente/,
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

  it("filters by null Cliente when there are no assignments (fail closed)", async () => {
    // The deprecated User.clienteId scalar is gone: no assignments matches
    // nothing, with no legacy fallback left to consult.
    getIds.mockResolvedValue([]);
    expect(await getClienteWhereClauseAsync(user())).toEqual({
      clienteId: { equals: null },
    });
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

  it("denies access outside the assignments (no legacy fallback)", async () => {
    // The deprecated User.clienteId scalar is gone: the junction table is
    // the only source of truth, so there is nothing left to fall back to.
    getIds.mockResolvedValue(["c1"]);
    expect(await canAccessClienteAsync(user(), "c9")).toBe(false);
  });

  it("denies access to an unrelated Cliente", async () => {
    getIds.mockResolvedValue(["c1"]);
    expect(await canAccessClienteAsync(user(), "c2")).toBe(false);
  });

  it("allows null-Cliente data only for fully Cliente-less users", async () => {
    getIds.mockResolvedValue([]);
    expect(await canAccessClienteAsync(user(), null)).toBe(true);
    getIds.mockResolvedValue(["c1"]);
    expect(await canAccessClienteAsync(user(), null)).toBe(false);
  });
});
