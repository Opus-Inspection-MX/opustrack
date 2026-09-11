import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fase 3 (H-08) reversal demo at unit level.
 *
 * Renaming the "CERRADO"/"ASIGNADO" labels must not break closeAssignment +
 * syncIncidentState: every resolution goes through the stable `code`.
 * TODO(promote): move to `src/test/integration/` once the Fase 2 Postgres
 * harness lands on main (no `*.int.test.ts` infra exists yet).
 */

const { notifyIncidentTransition } = vi.hoisted(() => ({
  notifyIncidentTransition: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    incident: { findUnique: vi.fn(), update: vi.fn() },
    assignment: { findMany: vi.fn() },
    incidentStatus: { findUnique: vi.fn() },
    incidentEvent: { create: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/notifications", () => ({
  deferAfterCommit: (task: () => Promise<void>) => {
    void task();
  },
  notifyIncidentTransition,
}));

import { prisma } from "@/lib/database/prisma.singleton";
import { ASSIGNMENT_STATE } from "./assignment-machine";
import { INCIDENT_STATE } from "./incident-machine";
import { syncIncidentState } from "./sync";

describe("syncIncidentState with renamed labels", () => {
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

  it("closes the incident when every assignment is closed by code", async () => {
    findUnique.mockResolvedValue({
      status: { code: INCIDENT_STATE.ABIERTO, name: "Start" },
    } as never);
    findMany.mockResolvedValue([
      { status: { code: ASSIGNMENT_STATE.CERRADO, name: "Done-renamed" } },
    ] as never);
    statusFindUnique.mockResolvedValue({ id: 9 } as never);

    const result = await syncIncidentState(1);

    // The target resolves by code: the renamed label is never consulted.
    expect(statusFindUnique).toHaveBeenCalledWith({
      where: { code: INCIDENT_STATE.CERRADO },
      select: { id: true },
    });
    expect(result).toEqual({
      before: INCIDENT_STATE.ABIERTO,
      after: INCIDENT_STATE.CERRADO,
    });
    const data = update.mock.calls[0]?.[0]?.data as {
      resolvedAt: Date | null;
    };
    expect(data.resolvedAt).toBeInstanceOf(Date);
  });

  it("still short-circuits on a renamed CANCELADA", async () => {
    findUnique.mockResolvedValue({
      status: { code: INCIDENT_STATE.CANCELADA, name: "Anulada" },
    } as never);

    const result = await syncIncidentState(1);

    expect(result).toEqual({
      before: INCIDENT_STATE.CANCELADA,
      after: INCIDENT_STATE.CANCELADA,
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("logs events with codes (same strings as system names)", async () => {
    findUnique.mockResolvedValue({
      status: { code: INCIDENT_STATE.ABIERTO, name: "Start" },
      resolvedAt: null,
    } as never);
    findMany.mockResolvedValue([
      { status: { code: ASSIGNMENT_STATE.ASIGNADO, name: "Taken-renamed" } },
    ] as never);
    statusFindUnique.mockResolvedValue({ id: 5 } as never);

    await syncIncidentState(1);

    const event = eventCreate.mock.calls[0]?.[0]?.data as unknown as {
      fromStatus: string;
      toStatus: string;
    };
    expect(event.fromStatus).toBe(INCIDENT_STATE.ABIERTO);
    expect(event.toStatus).toBe(INCIDENT_STATE.ASIGNADO);
  });
});
