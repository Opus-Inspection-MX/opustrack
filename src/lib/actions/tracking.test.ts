import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Business rules of the tracking module (RF-513 … RF-517).
 *
 * The rules worth pinning here are not "does Prisma work" but the shapes the
 * action builds: how a folio string becomes a query, where the day boundaries
 * land, and which FSRs are allowed to be assigned. Prisma is mocked and the
 * assertions are on the arguments it receives.
 */

const { prismaMock, requirePermission } = vi.hoisted(() => ({
  prismaMock: {
    incident: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    assignment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assignmentStatus: { findFirst: vi.fn(), findUnique: vi.fn() },
    assignmentAssignee: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    incidentAssignee: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  requirePermission: vi.fn(async (_name: string) => ({ id: "admin" })),
}));

const { syncIncidentState, notifyAssignmentAssigned } = vi.hoisted(() => ({
  syncIncidentState: vi.fn(),
  notifyAssignmentAssigned: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/state-machine/sync", () => ({ syncIncidentState }));
vi.mock("@/lib/notifications/notify-events", () => ({
  notifyAssignmentAssigned,
}));

import { APP_TZ } from "@/lib/utils/datetime";
import {
  assignFSRToIncident,
  getIncidentsForTracking,
  updateAssignmentAssignees,
  updateAssignmentDetails,
  updateIncidentDetails,
} from "./tracking";

/** The `where` the action handed to `findMany`. */
function lastWhere() {
  return prismaMock.incident.findMany.mock.calls.at(-1)?.[0]?.where;
}

/** The full argument object of the last `findMany`. */
function lastArgs() {
  return prismaMock.incident.findMany.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.incident.findMany.mockResolvedValue([]);
  prismaMock.incident.count.mockResolvedValue(0);
  prismaMock.assignment.findFirst.mockResolvedValue(null);
  prismaMock.assignment.findUnique.mockResolvedValue({ incidentId: 1 });
  prismaMock.assignmentStatus.findFirst.mockResolvedValue({ id: 2 });
  prismaMock.assignmentStatus.findUnique.mockResolvedValue({
    name: "ASIGNADO",
  });
  prismaMock.assignmentAssignee.findMany.mockResolvedValue([]);
  prismaMock.assignmentAssignee.findUnique.mockResolvedValue(null);
  prismaMock.incidentAssignee.findFirst.mockResolvedValue({ id: "ia1" });
  prismaMock.incidentAssignee.findMany.mockResolvedValue([]);
  prismaMock.incident.findUnique.mockResolvedValue({ title: "Incidente" });
  prismaMock.assignment.create.mockResolvedValue({ id: "a-new" });
  // Everyone asked about is an FSR unless a test says otherwise, which is what
  // `assertAreFsrs` checks: it compares the row count to the id count.
  prismaMock.user.findMany.mockImplementation(
    async (args: { where?: { id?: { in?: string[] } } }) =>
      (args?.where?.id?.in ?? []).map((id) => ({ id })),
  );
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(prismaMock),
  );
});

// ---------------------------------------------------------------------------
// RF-513 · búsqueda inteligente de folio
// ---------------------------------------------------------------------------
describe("getIncidentsForTracking · folio (RF-513)", () => {
  it("interpreta INC-42 y INC 42 como id de incidente", async () => {
    for (const folio of ["INC-42", "INC 42", "inc-42"]) {
      vi.clearAllMocks();
      prismaMock.incident.findMany.mockResolvedValue([]);
      prismaMock.incident.count.mockResolvedValue(0);

      await getIncidentsForTracking({ folio });

      expect(lastWhere().id, folio).toBe(42);
      expect(lastWhere().OR, folio).toBeUndefined();
    }
  });

  it("interpreta AS-42 como folio de asignación", async () => {
    await getIncidentsForTracking({ folio: "AS-42" });

    expect(lastWhere().assignments).toEqual({
      some: expect.objectContaining({ folio: 42, active: true }),
    });
    expect(lastWhere().id).toBeUndefined();
  });

  it("con solo dígitos busca en AMBOS — el escenario crítico de RF-513", async () => {
    await getIncidentsForTracking({ folio: "42" });

    expect(lastWhere().OR).toEqual([
      { id: 42 },
      { assignments: { some: expect.objectContaining({ folio: 42 }) } },
    ]);
  });

  it("ignora texto que no es un folio", async () => {
    await getIncidentsForTracking({ folio: "no-es-un-folio" });

    expect(lastWhere().id).toBeUndefined();
    expect(lastWhere().OR).toBeUndefined();
    expect(lastWhere().assignments).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// RF-513 · límite, orden y filtros
// ---------------------------------------------------------------------------
describe("getIncidentsForTracking · consulta (RF-513)", () => {
  it("limita a 200 y cuenta el total por separado, para el indicador de truncado", async () => {
    prismaMock.incident.count.mockResolvedValue(999);

    const result = await getIncidentsForTracking();

    expect(lastArgs().take).toBe(200);
    expect(result.totalCount).toBe(999);
  });

  it("ordena incidentes por reportedAt desc y asignaciones por createdAt desc", async () => {
    await getIncidentsForTracking();

    expect(lastArgs().orderBy).toEqual({ reportedAt: "desc" });
    expect(lastArgs().select.assignments.orderBy).toEqual({
      createdAt: "desc",
    });
  });

  it("solo considera incidentes y asignaciones activos", async () => {
    await getIncidentsForTracking({ assignedFsrId: "fsr1" });

    expect(lastWhere().active).toBe(true);
    expect(lastWhere().assignments.some.active).toBe(true);
  });

  it("filtra por cliente, tipo y estado", async () => {
    await getIncidentsForTracking({ clienteId: "c1", typeId: 3, statusId: 4 });

    expect(lastWhere()).toMatchObject({
      clienteId: "c1",
      typeId: 3,
      statusId: 4,
    });
  });

  it("acota el rango a días completos de CDMX, no del servidor", async () => {
    // 23:30 CDMX del día 10 debe caer dentro del filtro del día 10.
    await getIncidentsForTracking({
      startDate: "2026-06-10",
      endDate: "2026-06-10",
    });

    const { gte, lte } = lastWhere().reportedAt;
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: APP_TZ,
        dateStyle: "short",
        timeStyle: "medium",
      }).format(d);

    expect(fmt(gte)).toBe("2026-06-10 00:00:00");
    expect(fmt(lte)).toBe("2026-06-10 23:59:59");
  });
});

// ---------------------------------------------------------------------------
// RF-514 · asignación rápida de FSR
// ---------------------------------------------------------------------------
describe("assignFSRToIncident (RF-514)", () => {
  it("habilita en la incidencia al FSR que aún no lo estaba", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue({ id: "a1" });
    // Nobody enabled on the incident yet.
    prismaMock.incidentAssignee.findFirst.mockResolvedValue(null);

    const result = await assignFSRToIncident(1, "fsr1");

    // This used to be a rejection. Assigning now grants the enablement instead
    // of demanding it, so that creating an assignment and editing it accept the
    // same people — before, an FSR could be picked on create and refused on
    // edit, which is the error operators actually hit.
    expect(result).toEqual({ success: true });
    expect(prismaMock.incidentAssignee.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { incidentId_userId: { incidentId: 1, userId: "fsr1" } },
        update: { active: true },
      }),
    );
  });

  it("rechaza a quien no tiene rol FSR", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    // Returned, not thrown: a production build of Next replaces the message of
    // anything a Server Action throws, so throwing this rule reached the UI in
    // dev and vanished in production — proven by the e2e run.
    const result = await assignFSRToIncident(1, "no-es-fsr");

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/no tienen rol FSR/),
    });
    expect(prismaMock.assignment.create).not.toHaveBeenCalled();
    expect(prismaMock.assignmentAssignee.upsert).not.toHaveBeenCalled();
  });

  it("agrega el FSR a la asignación activa existente", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue({ id: "a1" });

    await assignFSRToIncident(1, "fsr1");

    expect(prismaMock.assignmentAssignee.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assignmentId_userId: { assignmentId: "a1", userId: "fsr1" } },
        update: { active: true },
      }),
    );
    expect(prismaMock.assignment.create).not.toHaveBeenCalled();
  });

  it("notifica al FSR recién agregado", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue({ id: "a1" });
    prismaMock.assignmentAssignee.findUnique.mockResolvedValue(null);

    await assignFSRToIncident(1, "fsr1");

    // Seguimiento assigned people and never told them.
    expect(notifyAssignmentAssigned).toHaveBeenCalledWith(
      "a1",
      "Incidente",
      ["fsr1"],
      "admin",
    );
  });

  it("no vuelve a notificar a quien ya estaba activo en la asignación", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue({ id: "a1" });
    prismaMock.assignmentAssignee.findUnique.mockResolvedValue({
      active: true,
    });

    await assignFSRToIncident(1, "fsr1");

    expect(notifyAssignmentAssigned).not.toHaveBeenCalled();
  });

  it("crea una asignación en ASIGNADO cuando no hay ninguna activa", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue(null);

    await assignFSRToIncident(1, "fsr1");

    expect(prismaMock.assignmentStatus.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "ASIGNADO" } }),
    );
    const created = prismaMock.assignment.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ incidentId: 1, statusId: 2 });
    expect(created.assignedAt).toBeInstanceOf(Date);
  });

  it("exige el permiso tracking:update", async () => {
    await assignFSRToIncident(1, "fsr1");
    expect(requirePermission).toHaveBeenCalledWith("tracking:update");
  });
});

// ---------------------------------------------------------------------------
// RF-515 · sincronización de asignados
// ---------------------------------------------------------------------------
describe("updateAssignmentAssignees (RF-515)", () => {
  it("deduplica los ids antes de validar", async () => {
    await updateAssignmentAssignees("a1", ["f1", "f1", "f1"]);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["f1"] } }),
      }),
    );
  });

  it("rechaza a quien no tiene rol FSR", async () => {
    // One of the two ids comes back from the role query; the other does not.
    prismaMock.user.findMany.mockResolvedValue([{ id: "f1" }]);

    const result = await updateAssignmentAssignees("a1", ["f1", "intruso"]);

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/no tienen rol FSR/),
    });
    // Rejected before touching the join table.
    expect(prismaMock.assignmentAssignee.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.assignmentAssignee.upsert).not.toHaveBeenCalled();
  });

  it("habilita en la incidencia a los FSR recién agregados", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue({ incidentId: 7 });
    prismaMock.assignmentAssignee.findMany.mockResolvedValue([
      { userId: "f1", active: true },
    ]);

    await updateAssignmentAssignees("a1", ["f1", "f2"]);

    // f2 is new: it gets the enablement instead of being rejected for lacking
    // it. f1 was already active and is not touched again.
    const enabled = prismaMock.incidentAssignee.upsert.mock.calls.map(
      (c) => c[0].where.incidentId_userId.userId,
    );
    expect(enabled).toEqual(["f2"]);
  });

  it("quitar a un FSR de la asignación no le retira la habilitación de la incidencia", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue({ incidentId: 7 });
    prismaMock.assignmentAssignee.findMany.mockResolvedValue([
      { userId: "f1", active: true },
      { userId: "f2", active: true },
    ]);

    const result = await updateAssignmentAssignees("a1", ["f1"]);

    // An incident can carry several assignments, so leaving one of them must
    // not silently revoke visibility of the whole incident. f2 loses its row in
    // `assignmentAssignee` and keeps the one in `incidentAssignee`.
    expect(result.success).toBe(true);
    expect(prismaMock.assignmentAssignee.updateMany).toHaveBeenCalledWith({
      where: { assignmentId: "a1", userId: { in: ["f2"] } },
      data: { active: false },
    });
    expect(prismaMock.incidentAssignee.upsert).not.toHaveBeenCalled();
  });

  it("solo notifica a los nuevos, no a los que ya estaban", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue({ incidentId: 7 });
    prismaMock.assignmentAssignee.findMany.mockResolvedValue([
      { userId: "f1", active: true },
    ]);

    await updateAssignmentAssignees("a1", ["f1", "f2"]);

    expect(notifyAssignmentAssigned).toHaveBeenCalledWith(
      "a1",
      "Incidente",
      ["f2"],
      "admin",
    );
  });

  it("reguardar sin cambios no notifica a nadie", async () => {
    prismaMock.assignmentAssignee.findMany.mockResolvedValue([
      { userId: "f1", active: true },
      { userId: "f2", active: true },
    ]);

    await updateAssignmentAssignees("a1", ["f1", "f2"]);

    expect(notifyAssignmentAssigned).not.toHaveBeenCalled();
  });

  it("rechaza si la asignación ya no existe", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue(null);

    const result = await updateAssignmentAssignees("a1", ["f1"]);

    expect(result.success).toBe(false);
  });

  it("desactiva los removidos y da de alta los nuevos, sin borrar filas", async () => {
    prismaMock.incidentAssignee.findMany.mockResolvedValue([
      { userId: "f2" },
      { userId: "f3" },
    ]);
    prismaMock.assignmentAssignee.findMany.mockResolvedValue([
      { userId: "f1", active: true },
      { userId: "f2", active: true },
    ]);

    await updateAssignmentAssignees("a1", ["f2", "f3"]);

    // f1 sale
    expect(prismaMock.assignmentAssignee.updateMany).toHaveBeenCalledWith({
      where: { assignmentId: "a1", userId: { in: ["f1"] } },
      data: { active: false },
    });
    // f3 entra; f2 ya estaba activo y no se vuelve a tocar
    const upserted = prismaMock.assignmentAssignee.upsert.mock.calls.map(
      (c) => c[0].where.assignmentId_userId.userId,
    );
    expect(upserted).toEqual(["f3"]);
  });

  it("con lista vacía no valida autorización y remueve a todos", async () => {
    prismaMock.assignmentAssignee.findMany.mockResolvedValue([
      { userId: "f1", active: true },
    ]);

    await updateAssignmentAssignees("a1", []);

    expect(prismaMock.incidentAssignee.findMany).not.toHaveBeenCalled();
    expect(prismaMock.assignmentAssignee.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    );
  });
});

// ---------------------------------------------------------------------------
// RF-516 / RF-517 · edición inline
// ---------------------------------------------------------------------------
describe("updateIncidentDetails (RF-516)", () => {
  it("limpia resolvedAt, lineId y equipmentId cuando llegan vacíos", async () => {
    await updateIncidentDetails(1, {
      title: "T",
      description: "D",
      reportedAt: "2026-06-10T10:00:00.000Z",
      statusId: 3,
    });

    expect(prismaMock.incident.update.mock.calls[0][0].data).toMatchObject({
      resolvedAt: null,
      lineId: null,
      equipmentId: null,
      statusId: 3,
    });
  });
});

describe("updateAssignmentDetails (RF-517)", () => {
  it("no cierra una asignación sin fecha de fin", async () => {
    prismaMock.assignmentStatus.findUnique.mockResolvedValue({
      name: "CERRADO",
    });

    // A closed assignment with no end date is work that finished at no moment:
    // every report that measures duration silently skips it.
    const result = await updateAssignmentDetails("a1", {
      statusId: 6,
      startedAt: "2026-08-14T09:00",
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/sin fecha de fin/),
    });
    expect(prismaMock.assignment.update).not.toHaveBeenCalled();
  });

  it("no inicia una asignación sin fecha de inicio", async () => {
    prismaMock.assignmentStatus.findUnique.mockResolvedValue({
      name: "INICIADO",
    });

    const result = await updateAssignmentDetails("a1", { statusId: 4 });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/sin fecha de inicio/),
    });
  });

  it("rechaza un fin anterior al inicio", async () => {
    prismaMock.assignmentStatus.findUnique.mockResolvedValue({
      name: "CERRADO",
    });

    const result = await updateAssignmentDetails("a1", {
      statusId: 6,
      startedAt: "2026-08-14T15:00",
      finishedAt: "2026-08-14T09:00",
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/anterior a la de inicio/),
    });
  });

  it("interpreta las fechas como hora de CDMX", async () => {
    await updateAssignmentDetails("a1", { startedAt: "2026-08-14T09:00" });

    // Plain `new Date()` reads the wall clock in the SERVER's zone — UTC on
    // Vercel — so the hour typed by the operator was stored six hours off.
    const stored = prismaMock.assignment.update.mock.calls[0][0].data.startedAt;
    expect(stored.toISOString()).toBe("2026-08-14T15:00:00.000Z");
  });

  it("acepta fechas nulas y no aplica la máquina de estados", async () => {
    await updateAssignmentDetails("a1", { statusId: 5 });

    expect(prismaMock.assignment.update.mock.calls[0][0].data).toEqual({
      statusId: 5,
      startedAt: null,
      finishedAt: null,
    });
  });
});
