import { beforeEach, describe, expect, it, vi } from "vitest";

const { dispatch, operationsAudience, incidentAssigneeFindMany } = vi.hoisted(
  () => ({
    dispatch: vi.fn(),
    operationsAudience: vi.fn(),
    incidentAssigneeFindMany: vi.fn(),
  }),
);

vi.mock("./dispatch", () => ({ dispatch }));
vi.mock("./audiences", () => ({
  operationsAudience,
  getVacationApprovers: vi.fn(async () => [] as string[]),
}));
vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: { incidentAssignee: { findMany: incidentAssigneeFindMany } },
}));

import { INCIDENT_STATE } from "@/lib/state-machine/incident-machine";
import { NOTIFICATION_TYPES } from "./notification-types";
import { notifyIncidentTransition } from "./notify-events";

/**
 * The Phase 3 matrix: every incident transition maps to exactly one event
 * (or to silence). Recipients are fixed by the plan — the channel matrix
 * decides the channel, never the audience.
 */

const SNAPSHOT = { title: "Bomba", reporterId: "rep-1", clientId: "c1" };

beforeEach(() => {
  vi.clearAllMocks();
  dispatch.mockResolvedValue(undefined);
  operationsAudience.mockResolvedValue(["ops-1"]);
  incidentAssigneeFindMany.mockResolvedValue([{ userId: "fsr-1" }]);
});

describe("matriz de fases del incidente", () => {
  it("cada avance de fase notifica al reportante + operación", async () => {
    const cases: Array<[string, string]> = [
      [INCIDENT_STATE.ABIERTO, INCIDENT_STATE.ASIGNADO],
      [INCIDENT_STATE.ASIGNADO, INCIDENT_STATE.VISTO],
      [INCIDENT_STATE.VISTO, INCIDENT_STATE.INICIADO],
      [INCIDENT_STATE.INICIADO, INCIDENT_STATE.EN_PROGRESO],
    ];
    const expected = [
      NOTIFICATION_TYPES.INCIDENT_PHASE_ASIGNADO,
      NOTIFICATION_TYPES.INCIDENT_PHASE_VISTO,
      NOTIFICATION_TYPES.INCIDENT_PHASE_INICIADO,
      NOTIFICATION_TYPES.INCIDENT_PHASE_EN_PROGRESO,
    ];
    for (const [index, [before, after]] of cases.entries()) {
      vi.clearAllMocks();
      await notifyIncidentTransition(7, before, after, "actor", SNAPSHOT);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith(
        expected[index],
        expect.objectContaining({
          recipients: ["rep-1", "ops-1"],
          actorId: "actor",
          ctx: { incidentId: 7, incidentTitle: "Bomba" },
          entity: { type: "incident", id: "7" },
        }),
      );
    }
  });

  it("cerrar suma a los FSRs asignados", async () => {
    await notifyIncidentTransition(
      7,
      INCIDENT_STATE.EN_PROGRESO,
      INCIDENT_STATE.CERRADO,
      "actor",
      SNAPSHOT,
    );
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.INCIDENT_CLOSED,
      expect.objectContaining({
        recipients: ["rep-1", "fsr-1", "ops-1"],
      }),
    );
  });

  it("reabrir (CERRADO → EN_PROGRESO) avisa a reportante + operación + FSRs", async () => {
    await notifyIncidentTransition(
      7,
      INCIDENT_STATE.CERRADO,
      INCIDENT_STATE.EN_PROGRESO,
      "actor",
      SNAPSHOT,
    );
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.INCIDENT_REOPENED,
      expect.objectContaining({
        recipients: ["rep-1", "fsr-1", "ops-1"],
      }),
    );
  });

  it("los retrocesos que no son reapertura no notifican", async () => {
    const regressions: Array<[string | null, string | null]> = [
      [INCIDENT_STATE.ASIGNADO, INCIDENT_STATE.ABIERTO],
      [INCIDENT_STATE.EN_PROGRESO, INCIDENT_STATE.INICIADO],
      [INCIDENT_STATE.VISTO, INCIDENT_STATE.ASIGNADO],
      [INCIDENT_STATE.ABIERTO, INCIDENT_STATE.ABIERTO],
      [null, INCIDENT_STATE.ASIGNADO],
      [INCIDENT_STATE.ASIGNADO, null],
      [INCIDENT_STATE.ABIERTO, INCIDENT_STATE.CANCELADA],
    ];
    for (const [before, after] of regressions) {
      vi.clearAllMocks();
      await notifyIncidentTransition(7, before, after, "actor", SNAPSHOT);
      expect(dispatch, `${before} → ${after}`).not.toHaveBeenCalled();
    }
  });
});
