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
  prismaMock: { incident: { findMany: vi.fn() } },
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
