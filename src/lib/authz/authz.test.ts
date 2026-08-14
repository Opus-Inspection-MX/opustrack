import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    role: { findMany: vi.fn(), findUnique: vi.fn() },
    userRole: { findMany: vi.fn() },
    permission: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/database/prisma.singleton";
import {
  clearPermissionsCache,
  getAccessibleRoutes,
  getDefaultPath,
  getUserAuthz,
  hasRole,
  isSuperuser,
  mergeRoles,
  type Permission,
  type Role,
  roleHasPermission,
  userCanAccessRoute,
  userCanPerformAction,
  userHasAllPermissions,
  userHasAnyPermission,
  userHasPermission,
} from "./authz";

/**
 * These tests pin the rule that makes multi-role work: a user's authorization
 * is the UNION of every role they hold. Getting this wrong does not fail
 * loudly — it silently gives someone one role's access and drops the rest.
 */

function perm(overrides: Partial<Permission> = {}): Permission {
  return {
    id: 1,
    name: "incidents:read",
    description: null,
    resource: null,
    action: null,
    routePath: null,
    exact: false,
    ...overrides,
  };
}

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 1,
    name: "FSR",
    description: null,
    defaultPath: "/fsr",
    isSuperuser: false,
    priority: 50,
    permissions: [],
    ...overrides,
  };
}

const FSR = role({
  id: 1,
  name: "FSR",
  defaultPath: "/fsr",
  priority: 50,
  permissions: [
    perm({ id: 1, name: "assignments:update", routePath: "/fsr" }),
    perm({ id: 2, name: "vacations:read", routePath: "/vacations" }),
    perm({
      id: 3,
      name: "incidents:read",
      resource: "incidents",
      action: "read",
    }),
  ],
});

const ADMIN_VACACIONES = role({
  id: 2,
  name: "ADMIN_VACACIONES",
  defaultPath: "/admin/vacations",
  priority: 70,
  permissions: [
    perm({ id: 4, name: "vacations:manage", routePath: "/admin/vacations" }),
    perm({ id: 5, name: "vacations:read", routePath: "/vacations" }),
    perm({
      id: 6,
      name: "route:admin-panel",
      routePath: "/admin",
      exact: true,
    }),
  ],
});

const ROOT = role({
  id: 3,
  name: "ROOT",
  defaultPath: "/admin",
  priority: 100,
  isSuperuser: true,
  permissions: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  clearPermissionsCache();
});

describe("mergeRoles · unión", () => {
  it("suma los permisos de todos los roles, sin duplicar", () => {
    const authz = mergeRoles([FSR, ADMIN_VACACIONES]);

    expect(authz.permissions).toContain("assignments:update");
    expect(authz.permissions).toContain("vacations:manage");
    // Present in both roles: a Set, so it appears once.
    expect(
      [...authz.permissions].filter((p) => p === "vacations:read"),
    ).toEqual(["vacations:read"]);
  });

  it("suma las rutas y separa las de coincidencia exacta", () => {
    const authz = mergeRoles([FSR, ADMIN_VACACIONES]);

    expect(authz.routeGrants.prefixes).toEqual(
      expect.arrayContaining(["/fsr", "/vacations", "/admin/vacations"]),
    );
    // `/admin` was granted with exact:true and must NOT become a prefix, or the
    // vacation admin would inherit the entire panel.
    expect(authz.routeGrants.prefixes).not.toContain("/admin");
    expect(authz.routeGrants.exact).toEqual(["/admin"]);
  });

  it("el defaultPath sale del rol de mayor prioridad", () => {
    // Order of the input must not matter.
    expect(mergeRoles([FSR, ADMIN_VACACIONES]).defaultPath).toBe(
      "/admin/vacations",
    );
    expect(mergeRoles([ADMIN_VACACIONES, FSR]).defaultPath).toBe(
      "/admin/vacations",
    );
  });

  it("desempata por id para que el resultado sea estable", () => {
    const a = role({ id: 9, name: "A", defaultPath: "/a", priority: 5 });
    const b = role({ id: 2, name: "B", defaultPath: "/b", priority: 5 });
    expect(mergeRoles([a, b]).defaultPath).toBe("/b");
    expect(mergeRoles([b, a]).defaultPath).toBe("/b");
  });

  it("es superusuario si CUALQUIER rol lo es", () => {
    expect(mergeRoles([FSR]).isSuperuser).toBe(false);
    expect(mergeRoles([FSR, ROOT]).isSuperuser).toBe(true);
  });

  it("indexa resource:action para las verificaciones por acción", () => {
    const authz = mergeRoles([FSR]);
    expect(userCanPerformAction(authz, "incidents", "read")).toBe(true);
    expect(userCanPerformAction(authz, "incidents", "delete")).toBe(false);
  });
});

describe("permisos del superusuario", () => {
  it("ROOT tiene todo aunque su lista esté vacía", () => {
    const authz = mergeRoles([ROOT]);

    // Implicit rather than seeded: a permission created after ROOT was seeded
    // must not lock the superuser out of the feature it guards.
    expect(userHasPermission(authz, "permiso:inventado")).toBe(true);
    expect(userCanPerformAction(authz, "loquesea", "create")).toBe(true);
    expect(userCanAccessRoute(authz, "/admin/roles")).toBe(true);
  });

  it("un admin de módulo NO hereda lo que no se le dio", () => {
    const authz = mergeRoles([ADMIN_VACACIONES]);

    expect(userHasPermission(authz, "vacations:manage")).toBe(true);
    // The whole point of the split: administering vacations is not a licence
    // to administer roles.
    expect(userHasPermission(authz, "roles:update")).toBe(false);
    expect(userCanAccessRoute(authz, "/admin/roles")).toBe(false);
    expect(userCanAccessRoute(authz, "/admin/incidents")).toBe(false);
    expect(isSuperuser(authz)).toBe(false);
  });
});

describe("acceso a rutas del usuario", () => {
  it("un usuario multi-rol alcanza las rutas de ambos", () => {
    const authz = mergeRoles([FSR, ADMIN_VACACIONES]);

    expect(userCanAccessRoute(authz, "/fsr/assignments")).toBe(true);
    expect(userCanAccessRoute(authz, "/admin/vacations")).toBe(true);
    expect(userCanAccessRoute(authz, "/admin")).toBe(true);
    expect(userCanAccessRoute(authz, "/admin/users")).toBe(false);
  });

  it("getAccessibleRoutes reúne prefijos y exactas", () => {
    expect(getAccessibleRoutes(mergeRoles([FSR, ADMIN_VACACIONES]))).toEqual([
      "/admin",
      "/admin/vacations",
      "/fsr",
      "/vacations",
    ]);
  });
});

describe("getUserAuthz", () => {
  it("une los roles activos del usuario", async () => {
    (prisma.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { role: { ...FSR, active: true, rolePermission: rp(FSR) } },
      {
        role: {
          ...ADMIN_VACACIONES,
          active: true,
          rolePermission: rp(ADMIN_VACACIONES),
        },
      },
    ]);

    const authz = await getUserAuthz("u1");

    expect(authz?.roles.map((r) => r.name)).toEqual([
      "FSR",
      "ADMIN_VACACIONES",
    ]);
    expect(authz && hasRole(authz, "ADMIN_VACACIONES")).toBe(true);
    expect(authz?.defaultPath).toBe("/admin/vacations");
  });

  it("devuelve null cuando el usuario no tiene ningún rol activo", async () => {
    (prisma.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    // Not an empty permission set: that would be a session that looks valid and
    // denies every page, which reads as a broken app rather than a revoked user.
    expect(await getUserAuthz("u1")).toBeNull();
  });
});

describe("helpers", () => {
  it("roleHasPermission mira un solo rol", () => {
    expect(roleHasPermission(FSR, "assignments:update")).toBe(true);
    expect(roleHasPermission(FSR, "vacations:manage")).toBe(false);
  });

  it("userHasAllPermissions / userHasAnyPermission", () => {
    const authz = mergeRoles([FSR, ADMIN_VACACIONES]);
    expect(
      userHasAllPermissions(authz, ["assignments:update", "vacations:manage"]),
    ).toBe(true);
    expect(
      userHasAllPermissions(authz, ["assignments:update", "roles:update"]),
    ).toBe(false);
    expect(
      userHasAnyPermission(authz, ["roles:update", "vacations:manage"]),
    ).toBe(true);
  });

  it("getDefaultPath cae a la raíz si no hay ninguno", () => {
    expect(getDefaultPath({ ...mergeRoles([FSR]), defaultPath: "" })).toBe("/");
  });
});

/** Shape a Role's permissions the way Prisma returns them. */
function rp(r: Role) {
  return r.permissions.map((permission) => ({
    permission: { ...permission, active: true },
  }));
}
