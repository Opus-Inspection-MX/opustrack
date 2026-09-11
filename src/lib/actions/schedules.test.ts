import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Business rules of the programación module (RF-400 … RF-409).
 *
 * Two rules carry real weight and are easy to break silently: the overlap
 * algorithm that decides which programaciones a date range returns, and the
 * per-Client access check — including the "global schedule" exception, where a
 * programación with no Clients is reachable by anyone.
 */

const { prismaMock, requirePermission, canAccessClientAsync, getReportScope } =
  vi.hoisted(() => ({
    prismaMock: {
      schedule: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      scheduleClient: {
        createMany: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      incident: { count: vi.fn() },
      client: { findMany: vi.fn() },
      $transaction: vi.fn(),
    },
    requirePermission: vi.fn(async (_name: string) => ({
      id: "u1",
      role: { name: "ADMINISTRADOR" },
    })),
    canAccessClientAsync: vi.fn((_user: unknown, _clientId: unknown) => true),
    getReportScope: vi.fn(
      async (_user: unknown): Promise<{ clientIds: string[] | null }> => ({
        clientIds: ["c1"],
      }),
    ),
  }));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/auth/filters", () => ({
  canAccessClientAsync: (user: unknown, clientId: unknown) =>
    canAccessClientAsync(user, clientId),
  getClientWhereClauseAsync: async () => ({}),
}));
// Real scope fragments, controllable scope resolution: the regression tests
// below prove getSchedules applies scheduleScopeWhere, not a lookalike.
vi.mock("@/lib/auth/report-scope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/report-scope")>();
  return {
    ...actual,
    getReportScope: (user: unknown) => getReportScope(user),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const REDIRECT = "NEXT_REDIRECT";
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT}:${path}`);
  },
}));

import { scheduleScopeWhere } from "@/lib/auth/report-scope";
import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  quickUpdateSchedule,
} from "./schedules";

const lastWhere = () =>
  prismaMock.schedule.findMany.mock.calls.at(-1)?.[0]?.where;

beforeEach(() => {
  vi.clearAllMocks();
  canAccessClientAsync.mockReturnValue(true);
  prismaMock.schedule.findMany.mockResolvedValue([]);
  prismaMock.schedule.count.mockResolvedValue(0);
  prismaMock.schedule.create.mockResolvedValue({ id: "s1" });
  prismaMock.schedule.findUnique.mockResolvedValue({ id: "s1" });
  prismaMock.schedule.update.mockResolvedValue({ id: "s1" });
  prismaMock.scheduleClient.findMany.mockResolvedValue([]);
  prismaMock.incident.count.mockResolvedValue(0);
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(prismaMock),
  );
});

// ---------------------------------------------------------------------------
// RF-400 · solapamiento
// ---------------------------------------------------------------------------
describe("getSchedules · solapamiento (RF-400)", () => {
  const from = new Date("2026-06-15T00:00:00.000Z");
  const to = new Date("2026-06-25T00:00:00.000Z");

  it("pide programaciones que empiezan antes del fin del rango", async () => {
    await getSchedules({ activeFrom: from, activeTo: to });

    expect(lastWhere().AND).toContainEqual({ scheduledAt: { lte: to } });
  });

  it("acepta las que terminan dentro, y las puntuales que caen dentro", async () => {
    await getSchedules({ activeFrom: from, activeTo: to });

    // A schedule without endDate is a point in time: it only overlaps when its
    // own scheduledAt falls inside the range.
    expect(lastWhere().AND).toContainEqual({
      OR: [
        { endDate: { gte: from } },
        { endDate: null, scheduledAt: { gte: from } },
      ],
    });
  });

  it("sin rango no impone condición de solapamiento", async () => {
    await getSchedules();

    // The AND carries only the Client scope — no scheduledAt/endDate key.
    expect(JSON.stringify(lastWhere())).not.toContain("scheduledAt");
    expect(JSON.stringify(lastWhere())).not.toContain("endDate");
  });

  it("busca por título y descripción, y filtra por cliente y estado", async () => {
    await getSchedules({ search: "manto", clientId: "c1", statusId: 3 });

    expect(lastWhere().AND).toContainEqual({
      OR: [
        { title: { contains: "manto", mode: "insensitive" } },
        { description: { contains: "manto", mode: "insensitive" } },
      ],
    });
    expect(lastWhere().AND).toContainEqual({
      clients: { some: { clientId: "c1", active: true } },
    });
    expect(lastWhere().AND).toContainEqual({ statusId: 3 });
  });

  it("solo devuelve programaciones activas", async () => {
    await getSchedules();
    expect(lastWhere().active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3.0.2 · getSchedules aplica el alcance por Cliente
// ---------------------------------------------------------------------------
// Regression: the list used to ignore the caller's scope entirely, so any
// role with schedules:read saw every center's agenda. The scope rides as one
// AND branch next to the filters — it must never merge into the search OR.
describe("getSchedules · alcance por Cliente (Fase 3 · 3.0.2)", () => {
  it("aplica scheduleScopeWhere junto a los filtros", async () => {
    getReportScope.mockResolvedValue({ clientIds: ["c1"] });

    await getSchedules({ search: "manto" });

    expect(lastWhere().AND).toContainEqual(
      scheduleScopeWhere({ clientIds: ["c1"] }),
    );
    // …and the search stays its own branch, ANDed with the scope.
    expect(lastWhere().AND).toContainEqual({
      OR: [
        { title: { contains: "manto", mode: "insensitive" } },
        { description: { contains: "manto", mode: "insensitive" } },
      ],
    });
  });

  it("un scope vacío no devuelve nada — ni siquiera globales", async () => {
    getReportScope.mockResolvedValue({ clientIds: [] });

    await getSchedules();

    expect(lastWhere().AND).toContainEqual(
      scheduleScopeWhere({ clientIds: [] }),
    );
    expect(JSON.stringify(lastWhere())).toContain('"in":[]');
  });

  it("un scope admin no restringe", async () => {
    getReportScope.mockResolvedValue({ clientIds: null });

    await getSchedules();

    expect(lastWhere().AND).toContainEqual(
      scheduleScopeWhere({ clientIds: null }),
    );
    expect(JSON.stringify(lastWhere())).not.toContain("clients");
  });
});

// ---------------------------------------------------------------------------
// RF-409 · acceso por Client
// ---------------------------------------------------------------------------
describe("createSchedule · acceso a Clientes (RF-409)", () => {
  const base = {
    title: "Programación",
    scheduledAt: new Date("2026-06-10T09:00:00.000Z"),
    clientIds: ["c100000001", "c200000002"],
  };

  it("verifica el acceso a cada Cliente", async () => {
    await createSchedule(base);

    expect(canAccessClientAsync).toHaveBeenCalledTimes(2);
  });

  it("rechaza y no escribe si falta acceso a alguno", async () => {
    canAccessClientAsync.mockImplementation(
      (_u: unknown, id: unknown) => id !== "c200000002",
    );

    // A denied rule is RETURNED, never thrown: production strips the message
    // of anything a Server Action throws, so the rejection must cross the
    // boundary as a value the UI can show.
    const result = await createSchedule(base);
    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/c2/),
    });
    expect(prismaMock.schedule.create).not.toHaveBeenCalled();
  });

  it("deduplica los Clientes recibidos", async () => {
    await createSchedule({
      ...base,
      clientIds: ["c100000001", "c100000001", "c100000001"],
    });

    expect(prismaMock.scheduleClient.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ scheduleId: "s1", clientId: "c100000001" }],
      }),
    );
  });

  it("una programación global (sin Clientes) no verifica acceso", async () => {
    await createSchedule({ ...base, clientIds: [] });

    expect(canAccessClientAsync).not.toHaveBeenCalled();
    expect(prismaMock.schedule.create).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RF-404 · actualización rápida desde el calendario
// ---------------------------------------------------------------------------
describe("quickUpdateSchedule (RF-404)", () => {
  const scheduledAt = new Date("2026-06-10T09:00:00.000Z");

  it("rechaza una fecha de fin anterior al inicio", async () => {
    const result = await quickUpdateSchedule("s1", {
      scheduledAt,
      endDate: new Date("2026-06-09T09:00:00.000Z"),
      clientIds: [],
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/no puede ser anterior/),
    });
    expect(prismaMock.schedule.update).not.toHaveBeenCalled();
  });

  it("acepta el mismo día como fin", async () => {
    await quickUpdateSchedule("s1", {
      scheduledAt,
      endDate: scheduledAt,
      clientIds: [],
    });

    expect(prismaMock.schedule.update).toHaveBeenCalled();
  });

  it("guarda endDate como null cuando no se envía", async () => {
    await quickUpdateSchedule("s1", { scheduledAt, clientIds: [] });

    expect(prismaMock.schedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { scheduledAt, endDate: null } }),
    );
  });
});

// ---------------------------------------------------------------------------
// RF-405 · borrado
// ---------------------------------------------------------------------------
describe("deleteSchedule (RF-405)", () => {
  it("no borra una programación con incidentes vinculados", async () => {
    prismaMock.incident.count.mockResolvedValue(2);

    const result = (await deleteSchedule("s1")) as {
      success: false;
      error: string;
    };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/2/);
    expect(prismaMock.schedule.update).not.toHaveBeenCalled();
  });

  it("hace soft delete cuando no hay incidentes", async () => {
    await expect(deleteSchedule("s1")).rejects.toThrow(REDIRECT);

    expect(prismaMock.schedule.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { active: false },
    });
  });

  it("solo cuenta incidentes activos", async () => {
    await deleteSchedule("s1").catch(() => {});

    expect(prismaMock.incident.count).toHaveBeenCalledWith({
      where: { scheduleId: "s1", active: true },
    });
  });
});
