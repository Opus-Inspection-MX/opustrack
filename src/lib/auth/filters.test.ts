import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {},
}));

vi.mock("@/lib/utils/client-assignments", () => ({
  getUserClientIds: vi.fn(),
}));

import {
  mergeRoles,
  type Role,
  SCOPE_ALL_CLIENTS,
  type UserWithPermissions,
} from "@/lib/authz/authz";
import { getUserClientIds } from "@/lib/utils/client-assignments";
import {
  assertClientAccessAsync,
  canAccessClientAsync,
  isAdmin,
} from "./filters";

const getIds = vi.mocked(getUserClientIds);

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 2,
    name: "REPORTER",
    description: null,
    defaultPath: "/reporter",
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
 * Cross-Client scope is a PERMISSION, not the role name.
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
          name: SCOPE_ALL_CLIENTS,
          description: null,
          resource: "scope",
          action: "all-clients",
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
  it("is true for anyone holding scope:all-clients", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(user())).toBe(false);
  });

  it("is true for ROOT without the permission being seeded", () => {
    expect(isAdmin(root)).toBe(true);
  });
});

describe("assertClientAccessAsync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not throw when access is allowed", async () => {
    getIds.mockResolvedValue(["c1"]);
    await expect(
      assertClientAccessAsync(user(), "c1"),
    ).resolves.toBeUndefined();
  });

  it("raises a business rule when access is denied", async () => {
    getIds.mockResolvedValue(["c1"]);
    // Operator-facing denial: `guarded()` turns this into a returned
    // rejection instead of a production-invisible throw.
    await expect(assertClientAccessAsync(user(), "c2")).rejects.toThrow(
      /Sin acceso a los datos de este Cliente/,
    );
  });
});

describe("canAccessClientAsync (multi-Client)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets admins access any Client", async () => {
    expect(await canAccessClientAsync(admin, "c1")).toBe(true);
  });

  it("grants access when the Client is in the user's assignments", async () => {
    getIds.mockResolvedValue(["c1", "c2"]);
    expect(await canAccessClientAsync(user(), "c2")).toBe(true);
  });

  it("denies access outside the assignments (no legacy fallback)", async () => {
    // The deprecated User.clientId scalar is gone: the junction table is
    // the only source of truth, so there is nothing left to fall back to.
    getIds.mockResolvedValue(["c1"]);
    expect(await canAccessClientAsync(user(), "c9")).toBe(false);
  });

  it("denies access to an unrelated Client", async () => {
    getIds.mockResolvedValue(["c1"]);
    expect(await canAccessClientAsync(user(), "c2")).toBe(false);
  });

  it("allows null-Client data only for fully Client-less users", async () => {
    getIds.mockResolvedValue([]);
    expect(await canAccessClientAsync(user(), null)).toBe(true);
    getIds.mockResolvedValue(["c1"]);
    expect(await canAccessClientAsync(user(), null)).toBe(false);
  });
});
