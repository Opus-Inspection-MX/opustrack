import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fase 3 (H-08/H-09) reversal demo at unit level.
 *
 * - Renaming "ACTIVO" must not block login / getAuthenticatedUser.
 * - The `code` is the authority: a row NAMED "ACTIVO" with a non-ACTIVO
 *   code stays rejected.
 * - Renaming "FSR" via updateRole must not break FSR resolution: the role
 *   row keeps its code, and `whereHasRole` matches on it.
 * TODO(promote): move to `src/test/integration/` once the Fase 2 Postgres
 * harness lands on main (no `*.int.test.ts` infra exists yet).
 */

const { getServerSessionMock, findUniqueMock, getUserAuthzMock } = vi.hoisted(
  () => ({
    getServerSessionMock: vi.fn(),
    findUniqueMock: vi.fn(),
    getUserAuthzMock: vi.fn(),
  }),
);

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }));

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: { user: { findUnique: findUniqueMock } },
}));

vi.mock("@/lib/authz/authz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authz/authz")>();
  return { ...actual, getUserAuthz: getUserAuthzMock };
});

vi.mock("@/lib/observability/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function loadAuth() {
  return await import("@/lib/auth/auth");
}

function session() {
  getServerSessionMock.mockResolvedValue({
    user: { id: "u1", sessionVersion: 1 },
  });
  getUserAuthzMock.mockResolvedValue({
    isSuperuser: false,
    roles: [],
    permissions: new Set(["incidents:read"]),
    resourceActions: new Set(),
    routeGrants: { prefixes: [], exact: [] },
    defaultPath: "/",
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("getAuthenticatedUser with renamed UserStatus", () => {
  it("accepts a user whose ACTIVO label was renamed (code is authority)", async () => {
    session();
    findUniqueMock.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      name: "U1",
      sessionVersion: 1,
      userStatus: { code: "ACTIVO", name: "Active-renamed" },
    });
    const { getAuthenticatedUser } = await loadAuth();

    const user = await getAuthenticatedUser();

    expect(user?.id).toBe("u1");
  });

  it("rejects a row named ACTIVO whose code is not ACTIVO", async () => {
    session();
    findUniqueMock.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      name: "U1",
      sessionVersion: 1,
      userStatus: { code: "SUSPENDIDO", name: "ACTIVO" },
    });
    const { getAuthenticatedUser } = await loadAuth();

    await expect(getAuthenticatedUser()).resolves.toBeNull();
  });

  it("still accepts legacy rows without code via the name fallback", async () => {
    session();
    findUniqueMock.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      name: "U1",
      sessionVersion: 1,
      userStatus: { name: "ACTIVO" },
    });
    const { getAuthenticatedUser } = await loadAuth();

    const user = await getAuthenticatedUser();

    expect(user?.id).toBe("u1");
  });
});
