import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    incident: { findUnique: vi.fn(), update: vi.fn() },
    assignment: { findMany: vi.fn() },
    incidentStatus: { findUnique: vi.fn() },
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

  beforeEach(() => {
    vi.clearAllMocks();
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
});
