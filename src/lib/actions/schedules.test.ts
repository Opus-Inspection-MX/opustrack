import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Business rules of the programación module (RF-400 … RF-409).
 *
 * Two rules carry real weight and are easy to break silently: the overlap
 * algorithm that decides which programaciones a date range returns, and the
 * per-Cliente access check — including the "global schedule" exception, where a
 * programación with no Clientes is reachable by anyone.
 */

const { prismaMock, requirePermission, canAccessCliente } = vi.hoisted(() => ({
  prismaMock: {
    schedule: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    scheduleCliente: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    incident: { count: vi.fn() },
    cliente: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  requirePermission: vi.fn(async (_name: string) => ({
    id: "u1",
    role: { name: "ADMINISTRADOR" },
  })),
  canAccessCliente: vi.fn((_user: unknown, _clienteId: unknown) => true),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/auth/filters", () => ({
  canAccessCliente: (user: unknown, clienteId: unknown) =>
    canAccessCliente(user, clienteId),
  getClienteWhereClause: () => ({}),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const REDIRECT = "NEXT_REDIRECT";
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT}:${path}`);
  },
}));

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
  canAccessCliente.mockReturnValue(true);
  prismaMock.schedule.findMany.mockResolvedValue([]);
  prismaMock.schedule.count.mockResolvedValue(0);
  prismaMock.schedule.create.mockResolvedValue({ id: "s1" });
  prismaMock.schedule.findUnique.mockResolvedValue({ id: "s1" });
  prismaMock.schedule.update.mockResolvedValue({ id: "s1" });
  prismaMock.scheduleCliente.findMany.mockResolvedValue([]);
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

    expect(lastWhere().AND).toBeUndefined();
  });

  it("busca por título y descripción, y filtra por cliente y estado", async () => {
    await getSchedules({ search: "manto", clienteId: "c1", statusId: 3 });

    expect(lastWhere().OR).toEqual([
      { title: { contains: "manto", mode: "insensitive" } },
      { description: { contains: "manto", mode: "insensitive" } },
    ]);
    expect(lastWhere().clientes).toEqual({
      some: { clienteId: "c1", active: true },
    });
    expect(lastWhere().statusId).toBe(3);
  });

  it("solo devuelve programaciones activas", async () => {
    await getSchedules();
    expect(lastWhere().active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RF-409 · acceso por Cliente
// ---------------------------------------------------------------------------
describe("createSchedule · acceso a Clientes (RF-409)", () => {
  const base = {
    title: "Programación",
    scheduledAt: new Date("2026-06-10T09:00:00.000Z"),
    clienteIds: ["c1", "c2"],
  };

  it("verifica el acceso a cada Cliente", async () => {
    await createSchedule(base);

    expect(canAccessCliente).toHaveBeenCalledTimes(2);
  });

  it("rechaza y no escribe si falta acceso a alguno", async () => {
    canAccessCliente.mockImplementation(
      (_u: unknown, id: unknown) => id !== "c2",
    );

    await expect(createSchedule(base)).rejects.toThrow(/c2/);
    expect(prismaMock.schedule.create).not.toHaveBeenCalled();
  });

  it("deduplica los Clientes recibidos", async () => {
    await createSchedule({ ...base, clienteIds: ["c1", "c1", "c1"] });

    expect(prismaMock.scheduleCliente.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ scheduleId: "s1", clienteId: "c1" }],
      }),
    );
  });

  it("una programación global (sin Clientes) no verifica acceso", async () => {
    await createSchedule({ ...base, clienteIds: [] });

    expect(canAccessCliente).not.toHaveBeenCalled();
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
      clienteIds: [],
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
      clienteIds: [],
    });

    expect(prismaMock.schedule.update).toHaveBeenCalled();
  });

  it("guarda endDate como null cuando no se envía", async () => {
    await quickUpdateSchedule("s1", { scheduledAt, clienteIds: [] });

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
