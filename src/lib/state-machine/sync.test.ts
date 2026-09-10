import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    incident: { findUnique: vi.fn(), update: vi.fn() },
    assignment: { findMany: vi.fn() },
    incidentStatus: { findUnique: vi.fn() },
    incidentEvent: { create: vi.fn(), findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/database/prisma.singleton";
import { ASSIGNMENT_STATE } from "./assignment-machine";
import { INCIDENT_STATE } from "./incident-machine";
import {
  computeIncidentStateFromAssignmentStates,
  syncIncidentState,
} from "./sync";

describe("computeIncidentStateFromAssignmentStates (pure)", () => {
  it("returns ABIERTO when there are no assignments", () => {
    expect(computeIncidentStateFromAssignmentStates([])).toBe(
      INCIDENT_STATE.ABIERTO,
    );
  });

  it("returns CERRADO only when every assignment is closed", () => {
    expect(
      computeIncidentStateFromAssignmentStates([
        ASSIGNMENT_STATE.CERRADO,
        ASSIGNMENT_STATE.CERRADO,
      ]),
    ).toBe(INCIDENT_STATE.CERRADO);
  });

  it("does NOT close the incident when one sibling is still open", () => {
    expect(
      computeIncidentStateFromAssignmentStates([
        ASSIGNMENT_STATE.CERRADO,
        ASSIGNMENT_STATE.INICIADO,
      ]),
    ).toBe(INCIDENT_STATE.INICIADO);
  });

  it("maps a single assignment to its contribution", () => {
    expect(
      computeIncidentStateFromAssignmentStates([ASSIGNMENT_STATE.ASIGNADO]),
    ).toBe(INCIDENT_STATE.ASIGNADO);
    expect(
      computeIncidentStateFromAssignmentStates([
        ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
      ]),
    ).toBe(INCIDENT_STATE.ABIERTO);
  });

  it("picks the most advanced contribution among open assignments", () => {
    expect(
      computeIncidentStateFromAssignmentStates([
        ASSIGNMENT_STATE.ASIGNADO,
        ASSIGNMENT_STATE.EN_PROGRESO,
        ASSIGNMENT_STATE.VISTO,
      ]),
    ).toBe(INCIDENT_STATE.EN_PROGRESO);
  });

  it("ignores closed siblings when ranking open ones", () => {
    expect(
      computeIncidentStateFromAssignmentStates([
        ASSIGNMENT_STATE.CERRADO,
        ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
      ]),
    ).toBe(INCIDENT_STATE.ABIERTO);
  });
});

describe("syncIncidentState", () => {
  const findUnique = vi.mocked(prisma.incident.findUnique);
  const update = vi.mocked(prisma.incident.update);
  const findMany = vi.mocked(prisma.assignment.findMany);
  const statusFindUnique = vi.mocked(prisma.incidentStatus.findUnique);
  const eventCreate = vi.mocked(prisma.incidentEvent.create);
  const eventFindFirst = vi.mocked(prisma.incidentEvent.findFirst);

  beforeEach(() => {
    vi.clearAllMocks();
    eventCreate.mockResolvedValue({} as never);
    eventFindFirst.mockResolvedValue(null);
  });

  it("short-circuits on CANCELADA and never touches assignments or update", async () => {
    findUnique.mockResolvedValue({
      status: { name: INCIDENT_STATE.CANCELADA },
    } as never);

    const result = await syncIncidentState(1);

    expect(result).toEqual({
      before: INCIDENT_STATE.CANCELADA,
      after: INCIDENT_STATE.CANCELADA,
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("no-ops when the computed target equals the current state", async () => {
    findUnique.mockResolvedValue({
      status: { name: INCIDENT_STATE.ABIERTO },
    } as never);
    findMany.mockResolvedValue([]);

    const result = await syncIncidentState(1);

    expect(result).toEqual({
      before: INCIDENT_STATE.ABIERTO,
      after: INCIDENT_STATE.ABIERTO,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates the incident status when the target changes", async () => {
    findUnique.mockResolvedValue({
      status: { name: INCIDENT_STATE.ABIERTO },
    } as never);
    findMany.mockResolvedValue([
      { status: { name: ASSIGNMENT_STATE.ASIGNADO } },
    ] as never);
    statusFindUnique.mockResolvedValue({ id: 5 } as never);

    const result = await syncIncidentState(1);

    expect(result.after).toBe(INCIDENT_STATE.ASIGNADO);
    expect(update).toHaveBeenCalledTimes(1);
    const data = update.mock.calls[0]?.[0]?.data as {
      statusId: number;
      resolvedAt: Date | null;
    };
    expect(data.statusId).toBe(5);
    expect(data.resolvedAt).toBeNull();
  });

  it("sets resolvedAt when transitioning to CERRADO", async () => {
    findUnique.mockResolvedValue({
      status: { name: INCIDENT_STATE.EN_PROGRESO },
    } as never);
    findMany.mockResolvedValue([
      { status: { name: ASSIGNMENT_STATE.CERRADO } },
    ] as never);
    statusFindUnique.mockResolvedValue({ id: 9 } as never);

    const result = await syncIncidentState(1);

    expect(result.after).toBe(INCIDENT_STATE.CERRADO);
    const data = update.mock.calls[0]?.[0]?.data as { resolvedAt: Date | null };
    expect(data.resolvedAt).toBeInstanceOf(Date);
  });

  it("throws when the target status is missing from the catalog", async () => {
    findUnique.mockResolvedValue({
      status: { name: INCIDENT_STATE.ABIERTO },
    } as never);
    findMany.mockResolvedValue([
      { status: { name: ASSIGNMENT_STATE.ASIGNADO } },
    ] as never);
    statusFindUnique.mockResolvedValue(null);

    await expect(syncIncidentState(1)).rejects.toThrow(
      /no existe en el catálogo/,
    );
  });

  it("emits STATUS_CHANGED with from→to and a resolvedAt snapshot", async () => {
    findUnique.mockResolvedValue({
      status: { name: INCIDENT_STATE.ABIERTO },
      resolvedAt: null,
    } as never);
    findMany.mockResolvedValue([
      { status: { name: ASSIGNMENT_STATE.ASIGNADO } },
    ] as never);
    statusFindUnique.mockResolvedValue({ id: 5 } as never);

    await syncIncidentState(1);

    expect(eventCreate).toHaveBeenCalledTimes(1);
    const event = eventCreate.mock.calls[0]?.[0]?.data as {
      eventType: string;
      fromStatus: string;
      toStatus: string;
      actorId: string | null;
    };
    expect(event.eventType).toBe("STATUS_CHANGED");
    expect(event.fromStatus).toBe(INCIDENT_STATE.ABIERTO);
    expect(event.toStatus).toBe(INCIDENT_STATE.ASIGNADO);
    expect(event.actorId).toBeNull();
  });

  it("emits REOPENED with the prior closure timestamp when leaving CERRADO", async () => {
    const closedAt = new Date("2026-08-01T12:00:00Z");
    findUnique.mockResolvedValue({
      status: { name: INCIDENT_STATE.CERRADO },
      resolvedAt: closedAt,
    } as never);
    findMany.mockResolvedValue([
      { status: { name: ASSIGNMENT_STATE.EN_PROGRESO } },
    ] as never);
    statusFindUnique.mockResolvedValue({ id: 7 } as never);

    await syncIncidentState(1, prisma, { actorId: "admin-1" });

    expect(eventCreate).toHaveBeenCalledTimes(1);
    const event = eventCreate.mock.calls[0]?.[0]?.data as {
      eventType: string;
      actorId: string | null;
      payload: { priorResolvedAt: string };
    };
    expect(event.eventType).toBe("REOPENED");
    expect(event.actorId).toBe("admin-1");
    expect(event.payload.priorResolvedAt).toBe(closedAt.toISOString());
  });

  it("does not silently reopen a bulk-imported CERRADO row with no assignments", async () => {
    findUnique.mockResolvedValue({
      status: { name: INCIDENT_STATE.CERRADO },
      resolvedAt: new Date("2026-07-01T12:00:00Z"),
    } as never);
    findMany.mockResolvedValue([]);
    eventFindFirst.mockResolvedValue({ id: "bulk-event" } as never);

    const result = await syncIncidentState(1);

    expect(result).toEqual({
      before: INCIDENT_STATE.CERRADO,
      after: INCIDENT_STATE.CERRADO,
    });
    expect(update).not.toHaveBeenCalled();
    expect(eventCreate).toHaveBeenCalledTimes(1);
    const event = eventCreate.mock.calls[0]?.[0]?.data as {
      eventType: string;
    };
    expect(event.eventType).toBe("RECALC_SKIPPED");
  });

  it("still recalculates a genuinely emptied CERRADO incident (no BULK_IMPORTED event)", async () => {
    findUnique.mockResolvedValue({
      status: { name: INCIDENT_STATE.CERRADO },
      resolvedAt: null,
    } as never);
    findMany.mockResolvedValue([]);
    eventFindFirst.mockResolvedValue(null);
    statusFindUnique.mockResolvedValue({ id: 3 } as never);

    const result = await syncIncidentState(1);

    // Zero assignments derive ABIERTO: the transition stands, logged as a
    // reopen, because this row has no bulk-import history to protect.
    expect(result.after).toBe(INCIDENT_STATE.ABIERTO);
    expect(update).toHaveBeenCalledTimes(1);
    const event = eventCreate.mock.calls[0]?.[0]?.data as {
      eventType: string;
    };
    expect(event.eventType).toBe("REOPENED");
  });
});
