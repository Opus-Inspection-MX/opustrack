import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Business rules of the tracking module (RF-513 … RF-517).
 *
 * The rules worth pinning here are not "does Prisma work" but the shapes the
 * action builds: how a folio string becomes a query, where the day boundaries
 * land, and which FSRs are allowed to be assigned. Prisma is mocked and the
 * assertions are on the arguments it receives.
 */

const { prismaMock, requirePermission, getUserClientIds } = vi.hoisted(() => ({
  prismaMock: {
    incident: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    assignment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    assignmentStatus: { findFirst: vi.fn(), findUnique: vi.fn() },
    incidentStatus: { findUnique: vi.fn() },
    assignmentAttachment: { count: vi.fn() },
    // `aggregate` lives on both models: the auto-refresh signature asks each
    // one for a count and the newest updatedAt.
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
    incidentEvent: { create: vi.fn(), findFirst: vi.fn() },
    // RF-551: scalar incident edits emit an AuditLog row via logAudit.
    auditLog: { create: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  // Superuser by default: `getReportScope` short-circuits to an unrestricted
  // scope, so the existing tests keep asserting the raw filter shapes. The
  // scope block at the bottom overrides this per test.
  requirePermission: vi.fn(async (_name: string) => ({
    id: "admin",
    isSuperuser: true,
  })),
  getUserClientIds: vi.fn(async (_userId: string) => [] as string[]),
}));

const { syncIncidentState, notifyAssignmentAssigned, notifyIncidentAssigned } =
  vi.hoisted(() => ({
    syncIncidentState: vi.fn(),
    notifyAssignmentAssigned: vi.fn(),
    notifyIncidentAssigned: vi.fn(),
  }));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/utils/client-assignments", () => ({ getUserClientIds }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/state-machine/sync", () => ({ syncIncidentState }));
vi.mock("@/lib/notifications/notify-events", () => ({
  notifyAssignmentAssigned,
  notifyIncidentAssigned,
}));

import { APP_TZ } from "@/lib/utils/datetime";
import {
  assignFSRToIncident,
  getIncidentsForTracking,
  getTrackingSignature,
  overrideIncidentStatus,
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
  prismaMock.assignmentAttachment.count.mockResolvedValue(0);
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
  prismaMock.incident.aggregate.mockResolvedValue({
    _count: { _all: 0 },
    _max: { updatedAt: null },
  });
  prismaMock.assignment.aggregate.mockResolvedValue({
    _count: { _all: 0 },
    _max: { updatedAt: null },
  });
});

// ---------------------------------------------------------------------------
// Firma del refresco automático
// ---------------------------------------------------------------------------
describe("getTrackingSignature", () => {
  /** Deja la firma con estos cuatro valores. */
  function stub(
    incidents: { count: number; updatedAt: Date | null },
    assignments: { count: number; updatedAt: Date | null },
  ) {
    prismaMock.incident.aggregate.mockResolvedValue({
      _count: { _all: incidents.count },
      _max: { updatedAt: incidents.updatedAt },
    });
    prismaMock.assignment.aggregate.mockResolvedValue({
      _count: { _all: assignments.count },
      _max: { updatedAt: assignments.updatedAt },
    });
  }

  it("no trae ninguna fila: solo agregados", async () => {
    await getTrackingSignature();

    expect(prismaMock.incident.findMany).not.toHaveBeenCalled();
    expect(prismaMock.incident.aggregate).toHaveBeenCalledTimes(1);
    expect(prismaMock.assignment.aggregate).toHaveBeenCalledTimes(1);
  });

  it("usa el mismo where que la consulta real, filtros incluidos", async () => {
    await getIncidentsForTracking({ clientId: "c1", folio: "AS-42" });
    const queryWhere = lastWhere();

    vi.clearAllMocks();
    prismaMock.incident.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
    });
    prismaMock.assignment.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
    });

    await getTrackingSignature({ clientId: "c1", folio: "AS-42" });

    expect(prismaMock.incident.aggregate.mock.calls[0][0].where).toEqual(
      queryWhere,
    );
    // Las asignaciones se acotan a los incidentes de ese mismo conjunto.
    expect(prismaMock.assignment.aggregate.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ active: true, incident: queryWhere }),
    );
  });

  it("cambia cuando se cierra una asignación, aunque el incidente no se toque", async () => {
    const incidents = { count: 3, updatedAt: new Date("2026-08-14T10:00:00Z") };
    stub(incidents, { count: 5, updatedAt: new Date("2026-08-14T10:00:00Z") });
    const before = await getTrackingSignature();

    // Cerrar el trabajo escribe finishedAt en la Asignación: la fila del
    // Incidente conserva su updatedAt.
    stub(incidents, { count: 5, updatedAt: new Date("2026-08-14T11:00:00Z") });
    const after = await getTrackingSignature();

    expect(after).not.toBe(before);
  });

  it("cambia cuando una asignación se borra en suave, que no mueve ningún updatedAt visible", async () => {
    const incidents = { count: 3, updatedAt: new Date("2026-08-14T10:00:00Z") };
    const stamp = new Date("2026-08-14T09:00:00Z");
    stub(incidents, { count: 5, updatedAt: stamp });
    const before = await getTrackingSignature();

    stub(incidents, { count: 4, updatedAt: stamp });
    const after = await getTrackingSignature();

    expect(after).not.toBe(before);
  });

  it("no cambia si nada cambió", async () => {
    const state = [
      { count: 3, updatedAt: new Date("2026-08-14T10:00:00Z") },
      { count: 5, updatedAt: new Date("2026-08-14T11:00:00Z") },
    ] as const;

    stub(state[0], state[1]);
    const first = await getTrackingSignature();
    stub(state[0], state[1]);
    const second = await getTrackingSignature();

    expect(second).toBe(first);
  });

  it("sobrevive a una tabla vacía sin fechas", async () => {
    stub({ count: 0, updatedAt: null }, { count: 0, updatedAt: null });

    await expect(getTrackingSignature()).resolves.toBe("0:0:0:0");
  });
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
// Fase 6b · paginación del seguimiento
//
// El corte duro en 200 se reemplaza por página + tamaño (50/100/200) con
// orden estable. La firma no depende de la página: solo recibe filtros.
//
// TODO(promote-int): promote page-2-respects-scope to
// src/test/integration once the Fase 2 harness lands on main (today only
// the mocked-Prisma unit below pins the slice arguments).
// ---------------------------------------------------------------------------
describe("getIncidentsForTracking · paginación (Fase 6b)", () => {
  it("por defecto trae la página 1 con 50 filas", async () => {
    const result = await getIncidentsForTracking();

    expect(lastArgs().take).toBe(50);
    expect(lastArgs().skip ?? 0).toBe(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it("la página 2 recorta el segmento correcto", async () => {
    await getIncidentsForTracking({}, { page: 2 });

    expect(lastArgs().take).toBe(50);
    expect(lastArgs().skip).toBe(50);
  });

  it("acepta 100 y 200 como tamaños de página", async () => {
    await getIncidentsForTracking({}, { page: 2, pageSize: 100 });
    expect(lastArgs()).toMatchObject({ take: 100, skip: 100 });

    await getIncidentsForTracking({}, { page: 3, pageSize: 200 });
    expect(lastArgs()).toMatchObject({ take: 200, skip: 400 });
  });

  it("un tamaño fuera del contrato se acota a 50 y la página mínima es 1", async () => {
    const result = await getIncidentsForTracking({}, { page: 0, pageSize: 30 });

    expect(lastArgs()).toMatchObject({ take: 50, skip: 0 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it("ordena estable: reportedAt desc y desempate por id desc", async () => {
    await getIncidentsForTracking();

    expect(lastArgs().orderBy).toEqual([
      { reportedAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("devuelve el total y las páginas para la UI", async () => {
    prismaMock.incident.count.mockResolvedValue(999);

    const result = await getIncidentsForTracking({}, { page: 2 });

    expect(result.totalCount).toBe(999);
    expect(result.totalPages).toBe(20);
  });

  it("la firma no depende de la página: mismo where con distinta página", async () => {
    await getIncidentsForTracking({ clientId: "c1" }, { page: 2 });
    const page2Where = lastWhere();

    await getIncidentsForTracking({ clientId: "c1" }, { page: 5 });
    expect(lastWhere()).toEqual(page2Where);

    vi.clearAllMocks();
    prismaMock.incident.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
    });
    prismaMock.assignment.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
    });

    await getTrackingSignature({ clientId: "c1" });
    expect(prismaMock.incident.aggregate.mock.calls[0][0].where).toEqual(
      page2Where,
    );
  });
});

// ---------------------------------------------------------------------------
// RF-513 · límite, orden y filtros
// ---------------------------------------------------------------------------
describe("getIncidentsForTracking · consulta (RF-513)", () => {
  it("pagina por defecto y cuenta el total por separado, para la paginación", async () => {
    prismaMock.incident.count.mockResolvedValue(999);

    const result = await getIncidentsForTracking();

    expect(lastArgs().take).toBe(50);
    expect(result.totalCount).toBe(999);
    expect(result.totalPages).toBe(20);
  });

  it("ordena incidentes por reportedAt desc con desempate por id, y asignaciones por createdAt desc", async () => {
    await getIncidentsForTracking();

    expect(lastArgs().orderBy).toEqual([
      { reportedAt: "desc" },
      { id: "desc" },
    ]);
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
    await getIncidentsForTracking({ clientId: "c1", typeId: 3, statusId: 4 });

    expect(lastWhere()).toMatchObject({
      clientId: "c1",
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
    expect(notifyIncidentAssigned).toHaveBeenCalledWith(
      1,
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
    expect(notifyIncidentAssigned).not.toHaveBeenCalled();
  });

  it("crea una asignación en ASIGNADO cuando no hay ninguna activa", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue(null);

    await assignFSRToIncident(1, "fsr1");

    expect(prismaMock.assignmentStatus.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "ASIGNADO" } }),
    );
    const created = prismaMock.assignment.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ incidentId: 1, statusId: 2 });
    expect(created.assignedAt).toBeInstanceOf(Date);
  });

  it("exige el permiso tracking:update", async () => {
    await assignFSRToIncident(1, "fsr1");
    expect(requirePermission).toHaveBeenCalledWith("tracking:update");
  });

  it("logs ASSIGNEE_AUTO_CREATED when the FSR was not enabled on the incident", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue({ id: "a1" });
    prismaMock.incidentAssignee.findMany.mockResolvedValue([]);

    await assignFSRToIncident(1, "fsr1");

    expect(prismaMock.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: 1,
          eventType: "ASSIGNEE_AUTO_CREATED",
          actorId: "admin",
          payload: { userId: "fsr1", via: "assignment" },
        }),
      }),
    );
  });

  it("does not log auto-create when the FSR was already enabled", async () => {
    prismaMock.assignment.findFirst.mockResolvedValue({ id: "a1" });
    prismaMock.incidentAssignee.findMany.mockResolvedValue([
      { userId: "fsr1" },
    ]);

    await assignFSRToIncident(1, "fsr1");

    expect(prismaMock.incidentEvent.create).not.toHaveBeenCalled();
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
    expect(notifyIncidentAssigned).toHaveBeenCalledWith(
      7,
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
    expect(notifyIncidentAssigned).not.toHaveBeenCalled();
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
    prismaMock.incident.findUnique.mockResolvedValue({
      statusId: 1,
      status: { name: "ABIERTO" },
      assignments: [],
    });
    prismaMock.incidentStatus.findUnique.mockResolvedValue({
      name: "ASIGNADO",
    });

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
    // Sin asignaciones no hay nada que derivar: el estado validado se queda.
    expect(syncIncidentState).not.toHaveBeenCalled();
  });

  it("rechaza un salto de estado fuera de la máquina", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      statusId: 1,
      status: { name: "ABIERTO" },
      assignments: [],
    });
    prismaMock.incidentStatus.findUnique.mockResolvedValue({
      name: "CERRADO",
    });

    const result = await updateIncidentDetails(1, {
      title: "T",
      description: "D",
      reportedAt: "2026-06-10T10:00:00.000Z",
      statusId: 6,
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/Transición de incidencia inválida/),
    });
    expect(prismaMock.incident.update).not.toHaveBeenCalled();
  });

  it("rechaza CANCELADA: cancelar tiene su propia acción", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      statusId: 2,
      status: { name: "ASIGNADO" },
      assignments: [],
    });
    prismaMock.incidentStatus.findUnique.mockResolvedValue({
      name: "CANCELADA",
    });

    const result = await updateIncidentDetails(1, {
      title: "T",
      description: "D",
      reportedAt: "2026-06-10T10:00:00.000Z",
      statusId: 7,
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/acción de cancelación/),
    });
    expect(prismaMock.incident.update).not.toHaveBeenCalled();
  });

  it("sincroniza el estado derivado cuando hay asignaciones", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      statusId: 2,
      status: { name: "ASIGNADO" },
      assignments: [{ id: "a1" }],
    });
    prismaMock.incidentStatus.findUnique.mockResolvedValue({
      name: "VISTO",
    });

    const result = await updateIncidentDetails(1, {
      title: "T",
      description: "D",
      reportedAt: "2026-06-10T10:00:00.000Z",
      statusId: 3,
    });

    expect(result).toEqual({ success: true });
    expect(syncIncidentState).toHaveBeenCalledWith(1);
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

// ---------------------------------------------------------------------------
// Alcance por Client (regla transversal #4)
// ---------------------------------------------------------------------------
describe("getIncidentsForTracking · alcance por Cliente", () => {
  const scopedUser = {
    id: "fsr1",
    isSuperuser: false,
    permissions: new Set<string>(),
  };

  beforeEach(() => {
    requirePermission.mockResolvedValue(scopedUser);
    getUserClientIds.mockResolvedValue(["c1", "c2"]);
  });

  it("aplica el alcance multi-Cliente cuando no hay filtro explícito", async () => {
    await getIncidentsForTracking();

    // AND-compose (H-02, H-18): the scope rides in its own AND branch so no
    // caller key can ever replace it — never a bare `clientId` on the where.
    expect(lastWhere()).toEqual({
      AND: [{ active: true }, { clientId: { in: ["c1", "c2"] } }],
    });
  });

  it("respeta un filtro explícito dentro del alcance", async () => {
    await getIncidentsForTracking({ clientId: "c1" });

    expect(lastWhere()).toEqual({
      AND: [
        { active: true, clientId: "c1" },
        { clientId: { in: ["c1", "c2"] } },
      ],
    });
  });

  it("un filtro fuera del alcance no devuelve nada (fail closed)", async () => {
    await getIncidentsForTracking({ clientId: "c9" });

    // The explicit filter already matches nothing; the scope AND keeps it
    // that way instead of replacing it.
    expect(lastWhere()).toEqual({
      AND: [
        { active: true, clientId: { in: [] } },
        { clientId: { in: ["c1", "c2"] } },
      ],
    });
    expect(prismaMock.incident.findMany).toHaveBeenCalled();
  });

  it("un usuario sin Clientes no ve nada", async () => {
    getUserClientIds.mockResolvedValue([]);

    await getIncidentsForTracking();

    expect(lastWhere()).toEqual({
      AND: [{ active: true }, { clientId: { in: [] } }],
    });
  });

  it("la firma cubre el mismo conjunto con alcance", async () => {
    await getIncidentsForTracking({ clientId: "c1" });
    const queryWhere = lastWhere();

    vi.clearAllMocks();
    prismaMock.incident.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
    });
    prismaMock.assignment.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
    });

    await getTrackingSignature({ clientId: "c1" });

    expect(prismaMock.incident.aggregate.mock.calls[0][0].where).toEqual(
      queryWhere,
    );
  });
});

// ---------------------------------------------------------------------------
// La edición inline respeta las máquinas de estado
// ---------------------------------------------------------------------------
describe("updateAssignmentDetails · máquina de estados", () => {
  /** Fila de asignación con estado EN_PROGRESO en una incidencia abierta. */
  function openRow(overrides = {}) {
    return {
      incidentId: 1,
      status: { name: "EN_PROGRESO" },
      startedAt: new Date("2026-08-14T09:00:00.000Z"),
      finishedAt: null,
      startLatitude: 19.43,
      startLongitude: -99.13,
      // El formulario no captura GPS: la fila ya lo trae de la acción dedicada.
      endLatitude: 19.44,
      endLongitude: -99.14,
      odtFolio: "ODT-1",
      incident: { status: { name: "EN_PROGRESO" } },
      ...overrides,
    };
  }

  beforeEach(() => {
    prismaMock.assignment.findUnique.mockResolvedValue(openRow());
  });

  it("rechaza CERRADO sin evidencia aunque las fechas estén", async () => {
    prismaMock.assignmentStatus.findUnique.mockResolvedValue({
      name: "CERRADO",
    });
    prismaMock.assignmentAttachment.count.mockResolvedValue(0);

    const result = await updateAssignmentDetails("a1", {
      statusId: 6,
      startedAt: "2026-08-14T09:00",
      finishedAt: "2026-08-14T11:00",
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/al menos una evidencia/),
    });
    expect(prismaMock.assignment.update).not.toHaveBeenCalled();
  });

  it("rechaza CERRADO sin folio ODT", async () => {
    prismaMock.assignmentStatus.findUnique.mockResolvedValue({
      name: "CERRADO",
    });
    prismaMock.assignmentAttachment.count.mockResolvedValue(2);
    prismaMock.assignment.findUnique.mockResolvedValue(
      openRow({ odtFolio: null }),
    );

    const result = await updateAssignmentDetails("a1", {
      statusId: 6,
      startedAt: "2026-08-14T09:00",
      finishedAt: "2026-08-14T11:00",
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/folio ODT/),
    });
    expect(prismaMock.assignment.update).not.toHaveBeenCalled();
  });

  it("rechaza un salto de estado fuera de la máquina", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue(
      openRow({ status: { name: "ASIGNADO" } }),
    );
    prismaMock.assignmentStatus.findUnique.mockResolvedValue({
      name: "CERRADO",
    });

    const result = await updateAssignmentDetails("a1", {
      statusId: 6,
      startedAt: "2026-08-14T09:00",
      finishedAt: "2026-08-14T11:00",
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/Transición de asignación inválida/),
    });
    expect(prismaMock.assignment.update).not.toHaveBeenCalled();
  });

  it("no edita asignaciones de una incidencia cerrada", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue(
      openRow({ incident: { status: { name: "CERRADO" } } }),
    );

    const result = await updateAssignmentDetails("a1", {
      finishedAt: "2026-08-14T11:00",
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/incidencia está cerrada/),
    });
    expect(prismaMock.assignment.update).not.toHaveBeenCalled();
  });

  it("sincroniza la incidencia después de guardar", async () => {
    prismaMock.assignmentStatus.findUnique.mockResolvedValue({
      name: "EN_PROGRESO",
    });

    const result = await updateAssignmentDetails("a1", {
      statusId: 5,
      startedAt: "2026-08-14T09:00",
    });

    expect(result).toEqual({ success: true });
    expect(syncIncidentState).toHaveBeenCalledWith(1);
  });
});

describe("incident terminal · ningún editor es puerta trasera", () => {
  it("updateIncidentDetails no edita una incidencia cancelada", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      statusId: 9,
      status: { name: "CANCELADA" },
      assignments: [],
    });

    const result = await updateIncidentDetails(1, {
      title: "T",
      description: "D",
      reportedAt: "2026-06-10T10:00:00.000Z",
      statusId: 9,
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/incidencia está cancelada/),
    });
    expect(prismaMock.incident.update).not.toHaveBeenCalled();
  });

  it("updateIncidentDetails no edita una incidencia cerrada", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      statusId: 5,
      status: { name: "CERRADO" },
      assignments: [],
    });

    const result = await updateIncidentDetails(1, {
      title: "T",
      description: "D",
      reportedAt: "2026-06-10T10:00:00.000Z",
      statusId: 5,
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/incidencia está cerrada/),
    });
    expect(prismaMock.incident.update).not.toHaveBeenCalled();
  });

  it("updateAssignmentAssignees no toca asignaciones de una incidencia cancelada", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue({
      incidentId: 1,
      incident: { status: { name: "CANCELADA" } },
    });

    const result = await updateAssignmentAssignees("a1", ["fsr1"]);

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/incidencia está cancelada/),
    });
    expect(prismaMock.assignmentAssignee.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.assignmentAssignee.upsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// overrideIncidentStatus · RF-219 §1.3 mechanism (WITH audit)
// ---------------------------------------------------------------------------
describe("overrideIncidentStatus (RF-219 §1.3 mechanism)", () => {
  it("records ADMIN_OVERRIDE with actor, edge and reason", async () => {
    requirePermission.mockResolvedValue({ id: "admin", isSuperuser: true });
    prismaMock.incident.findUnique.mockResolvedValue({
      status: { name: "ABIERTO" },
      resolvedAt: null,
    });
    prismaMock.incidentStatus.findUnique.mockResolvedValue({ id: 5 });

    const result = await overrideIncidentStatus(
      1,
      "EN_PROGRESO",
      "  Orden directa del cliente.  ",
    );

    expect(result).toEqual({
      success: true,
      before: "ABIERTO",
      after: "EN_PROGRESO",
    });
    expect(prismaMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ statusId: 5 }),
      }),
    );
    expect(prismaMock.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: 1,
          eventType: "ADMIN_OVERRIDE",
          actorId: "admin",
          fromStatus: "ABIERTO",
          toStatus: "EN_PROGRESO",
          payload: expect.objectContaining({
            reason: "Orden directa del cliente.",
          }),
        }),
      }),
    );
  });

  it("rejects an override without a reason", async () => {
    const result = await overrideIncidentStatus(1, "EN_PROGRESO", "   ");

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/motivo/i),
    });
    expect(prismaMock.incident.update).not.toHaveBeenCalled();
    expect(prismaMock.incidentEvent.create).not.toHaveBeenCalled();
  });

  it("rejects CANCELADA as a target (use the cancel action)", async () => {
    const result = await overrideIncidentStatus(1, "CANCELADA", "porque sí");

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/cancelación/),
    });
    expect(prismaMock.incidentEvent.create).not.toHaveBeenCalled();
  });

  it("rejects overriding a cancelled incident", async () => {
    prismaMock.incident.findUnique.mockResolvedValue({
      status: { name: "CANCELADA" },
      resolvedAt: null,
    });

    const result = await overrideIncidentStatus(1, "ABIERTO", "reabrir");

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/cancelada/),
    });
    expect(prismaMock.incidentEvent.create).not.toHaveBeenCalled();
  });
});
