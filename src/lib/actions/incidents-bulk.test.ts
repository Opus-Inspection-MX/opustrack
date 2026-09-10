import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards of the bulk incident subsystem (extracted to `incidents-bulk.ts`).
 *
 * ~911 lines, zero tests: the subsystem takes raw CSV rows and writes many
 * incidents at once, so every missing guard multiplies. The rules pinned
 * here are the boundaries, not the happy path:
 *
 * - oversized/empty payloads are refused before any query;
 * - unknown schedules and schedules outside the caller's scope are refused;
 * - bulk-assign checks per-incident access on the CURRENT Client and on the
 *   TARGET Client/schedule (fail closed per row, never silently skipping);
 * - every entry point requires its permission first.
 */

const { prismaMock, requirePermission, canAccessClientAsync } = vi.hoisted(
  () => ({
    prismaMock: {
      incident: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        count: vi.fn(),
      },
      incidentType: { findMany: vi.fn(), findUnique: vi.fn() },
      incidentStatus: { findUnique: vi.fn() },
      client: { findMany: vi.fn(), findFirst: vi.fn() },
      schedule: { findFirst: vi.fn(), findMany: vi.fn() },
      user: { findMany: vi.fn() },
      incidentAssignee: { createMany: vi.fn(), updateMany: vi.fn() },
      incidentEvent: { create: vi.fn() },
      assignment: { findMany: vi.fn() },
      $transaction: vi.fn(),
    },
    requirePermission: vi.fn(async (_name: string) => ({ id: "admin" })),
    canAccessClientAsync: vi.fn(
      async (_user: unknown, _clientId: unknown) => true,
    ),
  }),
);

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/auth/filters", () => ({ canAccessClientAsync }));
vi.mock("@/lib/auth/report-scope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/report-scope")>();
  return {
    ...actual,
    getReportScope: async () => ({ clientIds: ["c1"] }),
  };
});

import {
  bulkAssignIncidents,
  createIncidentsFromPreview,
  resolveBulkIncidentRows,
} from "./incidents-bulk";

beforeEach(() => {
  vi.clearAllMocks();
  canAccessClientAsync.mockResolvedValue(true);
  prismaMock.incidentType.findMany.mockResolvedValue([]);
  prismaMock.client.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.schedule.findFirst.mockResolvedValue({
    id: "sched1",
    clients: [{ clientId: "c1" }],
  });
});

describe("resolveBulkIncidentRows · límites", () => {
  it("rechaza un payload vacío sin tocar la base", async () => {
    const result = await resolveBulkIncidentRows([], null, "template");

    expect(result).toEqual({
      ok: false,
      errors: [{ row: 0, message: "No hay filas para procesar" }],
    });
    expect(prismaMock.incidentType.findMany).not.toHaveBeenCalled();
  });

  it("rechaza más de 500 filas", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ titulo: `t${i}` }));

    const result = await resolveBulkIncidentRows(rows, null, "template");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toMatch(/501/);
    }
    expect(prismaMock.incidentType.findMany).not.toHaveBeenCalled();
  });

  it("exige permiso incidents:create antes de validar", async () => {
    await resolveBulkIncidentRows([], null, "template").catch(() => {});

    expect(requirePermission).toHaveBeenCalledWith("incidents:create");
  });
});

describe("resolveBulkIncidentRows · programación", () => {
  const row = { titulo: "Falla", descripcion: "Se cayó", tipo: "Red" };

  it("rechaza una programación inexistente", async () => {
    prismaMock.schedule.findFirst.mockResolvedValue(null);

    const result = await resolveBulkIncidentRows([row], "sched-x", "template");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toMatch(/sched-x/);
    }
  });

  it("rechaza una programación fuera del alcance", async () => {
    prismaMock.schedule.findFirst.mockResolvedValue({
      id: "sched9",
      clients: [{ clientId: "c9" }],
    });

    const result = await resolveBulkIncidentRows([row], "sched9", "template");

    expect(result).toEqual({
      ok: false,
      errors: [
        { row: 0, message: "Sin acceso a la programación seleccionada" },
      ],
    });
  });
});

describe("createIncidentsFromPreview · límites", () => {
  it("rechaza un preview vacío sin tocar la base", async () => {
    const result = await createIncidentsFromPreview([], null);

    expect(result).toEqual({
      ok: false,
      errors: [{ row: 0, message: "No hay filas para guardar" }],
    });
    expect(prismaMock.incidentStatus.findUnique).not.toHaveBeenCalled();
  });

  it("falla sin estados ABIERTO/CERRADO en el catálogo", async () => {
    prismaMock.incidentStatus.findUnique.mockResolvedValue(null);

    const result = await createIncidentsFromPreview(
      [
        {
          rowNumber: 1,
          title: "Falla",
          description: "x",
          startedAt: null,
          resolvedAt: null,
          clientId: "c1",
          clientCodeRaw: null,
          clientResolved: true,
          typeId: 1,
          typeNameRaw: null,
          typeResolved: true,
          assigneeIds: [],
          fieldErrors: {},
        },
      ],
      null,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toMatch(/ABIERTO/);
    }
    expect(prismaMock.incident.create).not.toHaveBeenCalled();
    expect(prismaMock.incident.createMany).not.toHaveBeenCalled();
  });

  it("emits BULK_IMPORTED per persisted row with initial status", async () => {
    prismaMock.incidentStatus.findUnique
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 6 });
    prismaMock.client.findMany.mockResolvedValue([{ id: "c1" }]);
    prismaMock.incidentType.findMany.mockResolvedValue([{ id: 3 }]);
    prismaMock.incidentType.findUnique.mockResolvedValue({ id: 9 });
    prismaMock.incident.create.mockResolvedValue({ id: 42 });
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => fn(prismaMock),
    );

    const result = await createIncidentsFromPreview(
      [
        {
          rowNumber: 2,
          title: "Falla histórica",
          description: "Importada cerrada",
          startedAt: "2026-06-01T12:00:00.000Z",
          resolvedAt: "2026-07-01T12:00:00.000Z",
          clientId: "c1",
          clientCodeRaw: null,
          clientResolved: true,
          typeId: 3,
          typeNameRaw: null,
          typeResolved: true,
          assigneeIds: [],
          fieldErrors: {},
        },
      ],
      null,
    );

    expect(result).toEqual({ ok: true, created: 1 });
    expect(prismaMock.incidentEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: 42,
          eventType: "BULK_IMPORTED",
          actorId: "admin",
          toStatus: "CERRADO",
          payload: expect.objectContaining({
            rowNumber: 2,
            initialStatus: "CERRADO",
          }),
        }),
      }),
    );
  });
});

describe("resolveBulkIncidentRows · encabezado dual cliente/client", () => {
  const base = {
    titulo: "Falla en cámara",
    descripcion: "Cámara 3 no enciende",
    tipo: "",
    fecha_inicio: "",
  };

  beforeEach(() => {
    prismaMock.client.findMany.mockResolvedValue([
      { id: "c1", code: "PUEBLA CVV01" },
      { id: "c2", code: "CAMIÓN-02" },
    ]);
  });

  it("resuelve la columna legacy `cliente` (insensible a mayúsculas)", async () => {
    const result = await resolveBulkIncidentRows(
      [{ ...base, client: "puebla cvv01" }],
      null,
      "template",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({
      clientId: "c1",
      clientCodeRaw: "puebla cvv01",
      clientResolved: true,
    });
  });

  it("resuelve la columna nueva `client` con tildes normalizadas", async () => {
    const result = await resolveBulkIncidentRows(
      [{ ...base, client: "camion-02" }],
      null,
      "template",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({
      clientId: "c2",
      clientCodeRaw: "camion-02",
      clientResolved: true,
    });
  });

  it("`client` precede a `cliente` cuando vienen ambas", async () => {
    const result = await resolveBulkIncidentRows(
      [{ ...base, client: "CAMIÓN-02", cliente: "PUEBLA CVV01" }],
      null,
      "template",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({
      clientId: "c2",
      clientCodeRaw: "CAMIÓN-02",
      clientResolved: true,
    });
  });

  it("marca error con la columna usada cuando el código no existe", async () => {
    const result = await resolveBulkIncidentRows(
      [{ ...base, client: "NOPE-99" }],
      null,
      "template",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].clientId).toBeNull();
    expect(result.rows[0].fieldErrors).toMatchObject({
      client: expect.stringContaining("NOPE-99"),
    });
  });

  it("el snapshot usa `clientId`", async () => {
    const result = await resolveBulkIncidentRows(
      [
        {
          title: "Falla histórica",
          description: "Importada",
          typeId: "",
          statusId: "",
          clientId: "c1",
          scheduleId: "",
          startedAt: "",
          resolvedAt: "",
          assigneeIds: "",
        },
      ],
      null,
      "snapshot",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({
      clientId: "c1",
      clientResolved: true,
    });
  });
});

describe("bulkAssignIncidents · resguardos", () => {
  it("rechaza selección vacía", async () => {
    const result = await bulkAssignIncidents([], { clientId: "c1" });

    expect(result.ok).toBe(false);
    expect(prismaMock.incident.findMany).not.toHaveBeenCalled();
  });

  it("rechaza cambios vacíos", async () => {
    const result = await bulkAssignIncidents([1, 2], {});

    expect(result.ok).toBe(false);
    expect(prismaMock.incident.findMany).not.toHaveBeenCalled();
  });

  it("reporta ids desconocidos por fila", async () => {
    prismaMock.incident.findMany.mockResolvedValue([{ id: 1, clientId: "c1" }]);
    prismaMock.client.findFirst.mockResolvedValue({ id: "c1" });

    const result = await bulkAssignIncidents([1, 2], { clientId: "c1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        incidentId: 2,
        message: "Incidente no encontrado",
      });
    }
  });

  it("niega filas cuyo Cliente actual está fuera del alcance", async () => {
    prismaMock.incident.findMany.mockResolvedValue([{ id: 1, clientId: "c9" }]);
    prismaMock.client.findFirst.mockResolvedValue({ id: "c1" });
    canAccessClientAsync.mockImplementation(
      async (_u: unknown, id: unknown) => id !== "c9",
    );

    const result = await bulkAssignIncidents([1], { clientId: "c1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        incidentId: 1,
        message: "Sin acceso al Cliente actual del incidente",
      });
    }
  });

  it("niega un Cliente destino inexistente o fuera del alcance", async () => {
    prismaMock.incident.findMany.mockResolvedValue([{ id: 1, clientId: "c1" }]);
    prismaMock.client.findFirst.mockResolvedValue(null);

    const missing = await bulkAssignIncidents([1], { clientId: "c-x" });
    expect(missing.ok).toBe(false);

    prismaMock.client.findFirst.mockResolvedValue({ id: "c9" });
    canAccessClientAsync.mockImplementation(
      async (_u: unknown, id: unknown) => id !== "c9",
    );
    const denied = await bulkAssignIncidents([1], { clientId: "c9" });
    expect(denied).toEqual({
      ok: false,
      errors: [{ incidentId: 0, message: "Sin acceso al Cliente destino" }],
    });
  });

  it("exige permiso incidents:update", async () => {
    await bulkAssignIncidents([], {}).catch(() => {});

    expect(requirePermission).toHaveBeenCalledWith("incidents:update");
  });
});
