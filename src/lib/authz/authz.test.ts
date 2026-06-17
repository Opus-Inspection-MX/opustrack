import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    role: { findMany: vi.fn(), findUnique: vi.fn() },
    permission: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/database/prisma.singleton";
import {
  clearPermissionsCache,
  getAccessibleRoutes,
  getAllRoles,
  getDefaultPath,
  getUserResourcePermissions,
  isAdmin,
  type Permission,
  type Role,
  roleCanAccessRoute,
  roleHasPermission,
  type UserWithPermissions,
  userCanPerformAction,
  userHasAllPermissions,
  userHasAnyPermission,
  userHasPermission,
} from "./authz";

function perm(overrides: Partial<Permission> = {}): Permission {
  return {
    id: 1,
    name: "incidents:read",
    description: null,
    resource: null,
    action: null,
    routePath: null,
    ...overrides,
  };
}

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 1,
    name: "FSR",
    description: null,
    defaultPath: "/fsr",
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
    roleId: 1,
    clienteId: null,
    role: role(),
    ...overrides,
  };
}

describe("roleHasPermission", () => {
  it("returns true when the role has the named permission", () => {
    const r = role({ permissions: [perm({ name: "incidents:read" })] });
    expect(roleHasPermission(r, "incidents:read")).toBe(true);
  });

  it("returns false when the permission is absent", () => {
    const r = role({ permissions: [perm({ name: "incidents:read" })] });
    expect(roleHasPermission(r, "incidents:delete")).toBe(false);
  });
});

describe("roleCanAccessRoute", () => {
  const fsr = role({
    name: "FSR",
    permissions: [perm({ name: "route:fsr", routePath: "/fsr" })],
  });

  it("grants access by exact route permission", () => {
    expect(roleCanAccessRoute(fsr, "/fsr")).toBe(true);
  });

  it("grants access to sub-routes via prefix match", () => {
    expect(roleCanAccessRoute(fsr, "/fsr/vacations")).toBe(true);
  });

  it("normalizes a trailing slash", () => {
    expect(roleCanAccessRoute(fsr, "/fsr/")).toBe(true);
  });

  it("denies routes the role has no permission for", () => {
    expect(roleCanAccessRoute(fsr, "/admin")).toBe(false);
  });

  it("grants ADMINISTRADOR access to everything regardless of permissions", () => {
    const admin = role({ name: "ADMINISTRADOR", permissions: [] });
    expect(roleCanAccessRoute(admin, "/admin/holidays")).toBe(true);
    expect(roleCanAccessRoute(admin, "/literally/anything")).toBe(true);
  });
});

describe("getAccessibleRoutes", () => {
  it("returns unique, sorted route paths and ignores permissions without a route", () => {
    const r = role({
      permissions: [
        perm({ routePath: "/incidents" }),
        perm({ routePath: "/admin" }),
        perm({ routePath: "/admin" }), // duplicate
        perm({ routePath: null }), // no route → excluded
      ],
    });
    expect(getAccessibleRoutes(r)).toEqual(["/admin", "/incidents"]);
  });
});

describe("user permission helpers", () => {
  const u = user({
    role: role({
      permissions: [
        perm({ name: "incidents:read", resource: "incidents", action: "read" }),
        perm({
          name: "incidents:create",
          resource: "incidents",
          action: "create",
        }),
        perm({ name: "parts:read", resource: "parts", action: "read" }),
      ],
    }),
  });

  it("userHasPermission delegates to the role", () => {
    expect(userHasPermission(u, "parts:read")).toBe(true);
    expect(userHasPermission(u, "parts:delete")).toBe(false);
  });

  it("userCanPerformAction matches resource + action", () => {
    expect(userCanPerformAction(u, "incidents", "create")).toBe(true);
    expect(userCanPerformAction(u, "incidents", "delete")).toBe(false);
  });

  it("getUserResourcePermissions filters by resource", () => {
    expect(getUserResourcePermissions(u, "incidents")).toHaveLength(2);
    expect(getUserResourcePermissions(u, "parts")).toHaveLength(1);
  });

  it("userHasAllPermissions requires every permission", () => {
    expect(userHasAllPermissions(u, ["incidents:read", "parts:read"])).toBe(
      true,
    );
    expect(userHasAllPermissions(u, ["incidents:read", "parts:delete"])).toBe(
      false,
    );
  });

  it("userHasAnyPermission requires at least one", () => {
    expect(userHasAnyPermission(u, ["nope", "parts:read"])).toBe(true);
    expect(userHasAnyPermission(u, ["nope", "nada"])).toBe(false);
  });
});

describe("getDefaultPath", () => {
  it("returns the role's default path", () => {
    expect(getDefaultPath(role({ defaultPath: "/client" }))).toBe("/client");
  });

  it("falls back to / when empty", () => {
    expect(getDefaultPath(role({ defaultPath: "" }))).toBe("/");
  });
});

describe("isAdmin", () => {
  it("is true only for ADMINISTRADOR", () => {
    expect(isAdmin(user({ role: role({ name: "ADMINISTRADOR" }) }))).toBe(true);
    expect(isAdmin(user({ role: role({ name: "FSR" }) }))).toBe(false);
  });
});

describe("permissions cache", () => {
  beforeEach(() => {
    clearPermissionsCache();
    vi.clearAllMocks();
  });

  it("caches getAllRoles within the TTL and refetches after clearing", async () => {
    const findMany = vi.mocked(prisma.role.findMany);
    findMany.mockResolvedValue([]);

    await getAllRoles();
    await getAllRoles();
    expect(findMany).toHaveBeenCalledTimes(1); // second call served from cache

    clearPermissionsCache();
    await getAllRoles();
    expect(findMany).toHaveBeenCalledTimes(2); // cache cleared → refetch
  });
});
