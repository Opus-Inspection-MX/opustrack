import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RF-407 · incidents shown on the programación calendar.
 *
 * The calendar is the one screen driven by a REST endpoint instead of a Server
 * Action, and its range query carries a rule that is easy to get wrong: it must
 * return incidents whose *schedule* overlaps the range, PLUS unscheduled
 * incidents *reported* inside it. Dropping either branch silently empties half
 * the calendar, so the `OR` is pinned here.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    incident: { findMany: vi.fn(), aggregate: vi.fn() },
    assignment: { aggregate: vi.fn() },
  },
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  // The real wrapper resolves the session first; the permission itself is
  // covered by the auth tests, so here it only needs to hand a user through.
  withPermission:
    (_permission: string, handler: (req: Request, user: unknown) => unknown) =>
    (req: Request) =>
      handler(req, { id: "admin", role: { name: "ADMINISTRADOR" } }),
}));

import { GET } from "./route";

const call = (query: string) =>
  GET(new Request(`http://localhost/api/schedules/incidents${query}`));

const lastWhere = () =>
  prismaMock.incident.findMany.mock.calls.at(-1)?.[0]?.where;

const RANGE = "?start=2026-06-15&end=2026-06-25";
const start = new Date("2026-06-15");
const end = new Date("2026-06-25");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.incident.findMany.mockResolvedValue([]);
  prismaMock.incident.aggregate.mockResolvedValue({
    _count: { _all: 0 },
    _max: { updatedAt: null },
  });
  prismaMock.assignment.aggregate.mockResolvedValue({
    _count: { _all: 0 },
    _max: { updatedAt: null },
  });
});

describe("GET /api/schedules/incidents · validación", () => {
  it("exige start y end", async () => {
    for (const query of ["", "?start=2026-06-15", "?end=2026-06-25"]) {
      const response = await call(query);

      expect(response.status, query).toBe(400);
      await expect(response.json(), query).resolves.toMatchObject({
        error: expect.stringContaining("requeridos"),
      });
    }

    expect(prismaMock.incident.findMany).not.toHaveBeenCalled();
  });

  it("rechaza fechas que no son fechas", async () => {
    const response = await call("?start=ayer&end=2026-06-25");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("inválido"),
    });
    expect(prismaMock.incident.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/schedules/incidents · rango (RF-407)", () => {
  it("incluye incidentes cuya programación se solapa con el rango", async () => {
    await call(RANGE);

    expect(lastWhere().OR).toContainEqual({
      schedule: {
        active: true,
        scheduledAt: { lte: end },
        OR: [
          { endDate: { gte: start } },
          // Without endDate the programación is a point in time: it only
          // counts when it falls inside the range.
          { endDate: null, scheduledAt: { gte: start } },
        ],
      },
    });
  });

  it("incluye también los incidentes sin programación reportados en el rango", async () => {
    await call(RANGE);

    expect(lastWhere().OR).toContainEqual({
      scheduleId: null,
      reportedAt: { gte: start, lte: end },
    });
  });

  it("solo devuelve incidentes activos, ordenados por fecha de reporte", async () => {
    await call(RANGE);

    expect(lastWhere().active).toBe(true);
    expect(prismaMock.incident.findMany.mock.calls.at(-1)?.[0].orderBy).toEqual(
      {
        reportedAt: "asc",
      },
    );
  });

  it("acota por Cliente cuando se pide", async () => {
    await call(`${RANGE}&clienteId=c1`);

    expect(lastWhere().clienteId).toBe("c1");
  });

  it("sin clienteId no filtra por Cliente", async () => {
    await call(RANGE);

    expect(lastWhere().clienteId).toBeUndefined();
  });

  it("devuelve los incidentes con el conteo y el rango resuelto", async () => {
    prismaMock.incident.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const body = await (await call(RANGE)).json();

    expect(body).toMatchObject({
      success: true,
      count: 2,
      range: { start: start.toISOString(), end: end.toISOString() },
    });
    expect(body.data).toHaveLength(2);
  });

  it("no propaga fallos de base de datos al cliente", async () => {
    prismaMock.incident.findMany.mockRejectedValue(
      new Error("connection terminated: 10.0.0.4:5432"),
    );

    const response = await call(RANGE);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toContain("10.0.0.4");
  });
});

// ---------------------------------------------------------------------------
// ?signature=1 · la pregunta barata del refresco automático
// ---------------------------------------------------------------------------
describe("GET /api/schedules/incidents?signature=1", () => {
  const sign = (query = RANGE) => call(`${query}&signature=1`);

  const stub = (
    incidents: { count: number; updatedAt: Date | null },
    assignments: { count: number; updatedAt: Date | null },
  ) => {
    prismaMock.incident.aggregate.mockResolvedValue({
      _count: { _all: incidents.count },
      _max: { updatedAt: incidents.updatedAt },
    });
    prismaMock.assignment.aggregate.mockResolvedValue({
      _count: { _all: assignments.count },
      _max: { updatedAt: assignments.updatedAt },
    });
  };

  it("no trae ninguna fila: ese es el punto", async () => {
    await sign();

    expect(prismaMock.incident.findMany).not.toHaveBeenCalled();
  });

  it("pregunta por el mismo conjunto de filas que la consulta real", async () => {
    await call(RANGE);
    const queryWhere = lastWhere();

    vi.clearAllMocks();
    stub({ count: 0, updatedAt: null }, { count: 0, updatedAt: null });
    await sign();

    expect(prismaMock.incident.aggregate.mock.calls[0][0].where).toEqual(
      queryWhere,
    );
    expect(prismaMock.assignment.aggregate.mock.calls[0][0].where).toEqual({
      active: true,
      incident: queryWhere,
    });
  });

  it("cambia cuando se toca una asignación aunque el incidente siga igual", async () => {
    const incidents = { count: 4, updatedAt: new Date("2026-06-20T10:00:00Z") };
    stub(incidents, { count: 7, updatedAt: new Date("2026-06-20T10:00:00Z") });
    const before = (await (await sign()).json()).signature;

    stub(incidents, { count: 7, updatedAt: new Date("2026-06-20T12:00:00Z") });
    const after = (await (await sign()).json()).signature;

    expect(after).not.toBe(before);
  });

  it("es estable mientras nada cambie", async () => {
    stub(
      { count: 4, updatedAt: new Date("2026-06-20T10:00:00Z") },
      { count: 7, updatedAt: new Date("2026-06-20T12:00:00Z") },
    );

    const first = (await (await sign()).json()).signature;
    const second = (await (await sign()).json()).signature;

    expect(second).toBe(first);
  });

  it("respeta el filtro por Cliente", async () => {
    await sign(`${RANGE}&clienteId=c1`);

    expect(prismaMock.incident.aggregate.mock.calls[0][0].where).toMatchObject({
      clienteId: "c1",
    });
  });

  it("sigue exigiendo start y end", async () => {
    const response = await call("?signature=1");

    expect(response.status).toBe(400);
    expect(prismaMock.incident.aggregate).not.toHaveBeenCalled();
  });
});
