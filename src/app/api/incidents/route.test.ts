import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tenancy of the incidents REST endpoint (cross-cutting rule #4).
 *
 * The calendar screen and external consumers drive this endpoint instead of
 * the Server Actions, so the scope rules must hold here independently:
 *
 * - GET without a filter queries inside the caller's scope (fail closed).
 * - GET with an out-of-scope `clientId` is a 403, not an empty list that
 *   hides the denial.
 * - POST cannot file an incident under a Client outside the caller's scope
 *   (the form only offers in-scope Clients, but the endpoint must not
 *   trust that) — this was an open hole: POST scoped nothing.
 */

const { prismaMock, getUserClientIds, userBox } = vi.hoisted(() => ({
  prismaMock: {
    incident: { findMany: vi.fn(), create: vi.fn() },
    incidentType: { findUnique: vi.fn() },
    incidentStatus: { findUnique: vi.fn() },
  },
  getUserClientIds: vi.fn(async (_userId: string) => [] as string[]),
  // Swappable user: superuser by default; scope tests replace it.
  userBox: { user: { id: "admin", isSuperuser: true } as never },
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  withPermission:
    (_permission: string, handler: (req: Request, user: unknown) => unknown) =>
    (req: Request) =>
      handler(req, userBox.user),
}));
vi.mock("@/lib/utils/client-assignments", () => ({ getUserClientIds }));

import { GET, POST } from "./route";

const SCOPED = "c100000001";

function asScopedUser() {
  userBox.user = {
    id: "u1",
    isSuperuser: false,
    permissions: new Set<string>(),
  } as never;
  getUserClientIds.mockResolvedValue([SCOPED]);
}

function asSuperuser() {
  userBox.user = { id: "admin", isSuperuser: true } as never;
  getUserClientIds.mockResolvedValue([]);
}

const lastWhere = () =>
  prismaMock.incident.findMany.mock.calls.at(-1)?.[0]?.where;

const postJson = (body: unknown) =>
  POST(
    new Request("http://localhost/api/incidents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

const validBody = (overrides = {}) => ({
  title: "Falla",
  description: "Se cayó la red",
  clientId: SCOPED,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  asSuperuser();
  prismaMock.incident.findMany.mockResolvedValue([]);
  prismaMock.incidentType.findUnique.mockResolvedValue({ id: 3 });
  prismaMock.incidentStatus.findUnique.mockResolvedValue({ id: 1 });
  prismaMock.incident.create.mockImplementation(async (args: unknown) => ({
    id: 1,
    ...((args as { data?: Record<string, unknown> }).data ?? {}),
  }));
});

describe("GET /api/incidents · alcance por Cliente", () => {
  it("un usuario con alcance consulta solo dentro de sus Clientes", async () => {
    asScopedUser();

    await GET(new Request("http://localhost/api/incidents"));

    expect(lastWhere().clientId).toEqual({ in: [SCOPED] });
  });

  it("un filtro fuera del alcance es 403, no una lista vacía", async () => {
    asScopedUser();

    const response = await GET(
      new Request("http://localhost/api/incidents?clientId=c9"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/Sin acceso/),
    });
    expect(prismaMock.incident.findMany).not.toHaveBeenCalled();
  });

  it("un usuario sin Clientes no ve nada (fail closed)", async () => {
    userBox.user = {
      id: "u-bare",
      isSuperuser: false,
      permissions: new Set<string>(),
    } as never;
    getUserClientIds.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/incidents"));

    expect(lastWhere().clientId).toEqual({ in: [] });
  });
});

describe("POST /api/incidents · alcance por Cliente", () => {
  it("rechaza un Cliente fuera del alcance con 403 y no escribe", async () => {
    asScopedUser();

    const response = await postJson(validBody({ clientId: "c9" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/Sin acceso/),
    });
    expect(prismaMock.incident.create).not.toHaveBeenCalled();
  });

  it("acepta un Cliente dentro del alcance", async () => {
    asScopedUser();

    const response = await postJson(validBody());

    expect(response.status).toBe(200);
    expect(prismaMock.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: SCOPED }),
      }),
    );
  });

  it("un superusuario conserva acceso total", async () => {
    const response = await postJson(validBody({ clientId: "c9" }));

    expect(response.status).toBe(200);
    expect(prismaMock.incident.create).toHaveBeenCalled();
  });
});
