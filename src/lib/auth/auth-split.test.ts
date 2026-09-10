import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RF-557: the 403/500 split in the API wrappers.
 *
 * - Denial (no permission) is 403 with a generic body and NO error log.
 * - A genuine handler fault is 500 AND error-logged (redacted by the logger).
 * - Business rules and framework redirects keep their contract: they
 *   propagate, never log.
 *
 * `getAuthenticatedUser` is `cache()`d, so every test re-imports the auth
 * module after `vi.resetModules` — otherwise the first session would stick
 * for the whole file.
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

const { loggerErrorMock, loggerDebugMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  loggerDebugMock: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    debug: loggerDebugMock,
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock,
  },
}));

async function loadAuth() {
  return await import("@/lib/auth/auth");
}

/**
 * After `vi.resetModules` the re-imported auth module carries a fresh copy
 * of `result.ts`, so a statically imported `BusinessRuleError` would be a
 * different class identity and `instanceof` would fail. Tests that throw
 * business rules use the freshly imported class instead.
 */
async function loadBusinessRuleError() {
  const fresh = await import("@/lib/actions/result");
  return fresh.BusinessRuleError;
}

const okHandler = () =>
  Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));

/** Authenticated session + DB row + authz grants for one test user. */
function actAs(permissions: string[]) {
  getServerSessionMock.mockResolvedValue({
    user: { id: "u1", sessionVersion: 1 },
  });
  findUniqueMock.mockResolvedValue({
    id: "u1",
    email: "u1@example.com",
    name: "U1",
    sessionVersion: 1,
    userStatus: { name: "ACTIVO" },
  });
  getUserAuthzMock.mockResolvedValue({
    isSuperuser: false,
    permissions: new Set(permissions),
    resourceActions: new Set(
      permissions.filter((permission) => permission.includes(":")),
    ),
  });
}

function actAsAnonymous() {
  getServerSessionMock.mockResolvedValue(null);
}

const req = () => new Request("http://localhost/api/probe");

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("withPermission · RF-557", () => {
  it("denial is 403 without an error log and without leaking the permission", async () => {
    actAs([]);
    const { withPermission } = await loadAuth();
    const handler = vi.fn(okHandler);

    const response = await withPermission("incidents:read", handler)(req());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(handler).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalled();
    expect(loggerDebugMock).toHaveBeenCalledOnce();
  });

  it("a handler fault is 500 and error-logged", async () => {
    actAs(["incidents:read"]);
    const { withPermission } = await loadAuth();

    const response = await withPermission("incidents:read", async () => {
      throw new Error("db exploded");
    })(req());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
    expect(loggerErrorMock).toHaveBeenCalledOnce();
    expect(loggerErrorMock.mock.calls[0]?.[0]).toBe("api.handler_fault");
  });

  it("a business rule propagates unlogged", async () => {
    actAs(["incidents:read"]);
    const { withPermission } = await loadAuth();
    const BusinessRuleError = await loadBusinessRuleError();

    await expect(
      withPermission("incidents:read", async () => {
        throw new BusinessRuleError("La incidencia está cerrada.");
      })(req()),
    ).rejects.toThrow("La incidencia está cerrada.");
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("a framework redirect propagates unlogged", async () => {
    actAs(["incidents:read"]);
    const { withPermission } = await loadAuth();
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });

    await expect(
      withPermission("incidents:read", async () => {
        throw redirect;
      })(req()),
    ).rejects.toBe(redirect);
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("passes granted requests through untouched", async () => {
    actAs(["incidents:read"]);
    const { withPermission } = await loadAuth();

    const response = await withPermission("incidents:read", okHandler)(req());

    expect(response.status).toBe(200);
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("missing session is 401, not 403 or 500", async () => {
    actAsAnonymous();
    const { withPermission } = await loadAuth();

    const response = await withPermission("incidents:read", okHandler)(req());

    expect(response.status).toBe(401);
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });
});

describe("withAction · RF-557", () => {
  it("denial is 403 without an error log; fault is 500 with a log", async () => {
    actAs([]);
    const deniedAuth = await loadAuth();
    const denied = await deniedAuth.withAction(
      "incidents",
      "create",
      okHandler,
    )(req());
    expect(denied.status).toBe(403);
    expect(loggerErrorMock).not.toHaveBeenCalled();

    actAs(["incidents:create"]);
    const faultAuth = await loadAuth();
    const fault = await faultAuth.withAction(
      "incidents",
      "create",
      async () => {
        throw new Error("boom");
      },
    )(req());
    expect(fault.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledOnce();
    expect(loggerErrorMock.mock.calls[0]?.[0]).toBe("api.handler_fault");
  });
});

describe("withAuth · fault split", () => {
  it("missing session is 401; handler fault is 500 and logged", async () => {
    actAsAnonymous();
    const anonymousAuth = await loadAuth();
    const unauthenticated = await anonymousAuth.withAuth(okHandler)(req());
    expect(unauthenticated.status).toBe(401);

    actAs([]);
    const faultAuth = await loadAuth();
    const fault = await faultAuth.withAuth(async () => {
      throw new Error("boom");
    })(req());
    expect(fault.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledOnce();
  });
});
