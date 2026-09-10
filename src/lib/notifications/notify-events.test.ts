import { beforeEach, describe, expect, it, vi } from "vitest";

const { dispatch, operationsAudience, getVacationApprovers } = vi.hoisted(
  () => ({
    dispatch: vi.fn(),
    operationsAudience: vi.fn(),
    getVacationApprovers: vi.fn(),
  }),
);

vi.mock("./dispatch", () => ({ dispatch }));
vi.mock("./audiences", () => ({ operationsAudience, getVacationApprovers }));
vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: { incidentAssignee: { findMany: vi.fn(async () => []) } },
}));

import { NOTIFICATION_TYPES } from "./notification-types";
import {
  notifyAssignmentUpdated,
  notifyBroadcast,
  notifyIncidentCancelled,
  notifyIncidentClosed,
  notifyIncidentCreated,
  notifyVacationCancelled,
  notifyVacationRequested,
} from "./notify-events";

/**
 * The facade contract: same public names as before, each resolving its
 * audience and delegating to `dispatch` with the right type and entity.
 * Rendering, channels and delivery are dispatch's business (see
 * dispatch.test.ts); here only the wiring is pinned.
 */

beforeEach(() => {
  vi.clearAllMocks();
  dispatch.mockResolvedValue(undefined);
  operationsAudience.mockResolvedValue(["ops-1"]);
  getVacationApprovers.mockResolvedValue(["appr-1"]);
});

describe("fachada de eventos", () => {
  it("un incidente nuevo va a la audiencia de operación con su entidad", async () => {
    await notifyIncidentCreated(7, "Bomba fuera de servicio", "actor", "c1");

    expect(operationsAudience).toHaveBeenCalledWith("c1");
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.INCIDENT_CREATED,
      expect.objectContaining({
        recipients: ["ops-1"],
        actorId: "actor",
        ctx: { incidentId: 7, incidentTitle: "Bomba fuera de servicio" },
        entity: { type: "incident", id: "7" },
      }),
    );
  });

  it("el cierre suma al reportante a la audiencia de operación", async () => {
    await notifyIncidentClosed(7, "Bomba", "rep-1", "actor", "c9");

    expect(operationsAudience).toHaveBeenCalledWith("c9");
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.INCIDENT_CLOSED,
      expect.objectContaining({ recipients: ["rep-1", "ops-1"] }),
    );
  });

  it("la cancelación lleva reportante + FSRs + operación con su entidad", async () => {
    await notifyIncidentCancelled(
      7,
      { title: "Bomba", reporterId: "rep-1", clientId: "c9" },
      "actor",
    );

    expect(operationsAudience).toHaveBeenCalledWith("c9");
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.INCIDENT_CANCELLED,
      expect.objectContaining({
        recipients: ["rep-1", "ops-1"],
        actorId: "actor",
        ctx: { incidentId: 7, incidentTitle: "Bomba" },
        entity: { type: "incident", id: "7" },
      }),
    );
  });

  it("la cancelación de vacaciones entrega a los destinatarios resueltos con su entidad", async () => {
    await notifyVacationCancelled("v1", "Ana", ["appr-1"], "actor");

    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.VACATION_CANCELLED,
      expect.objectContaining({
        recipients: ["appr-1"],
        actorId: "actor",
        ctx: { vacationId: "v1", requesterName: "Ana" },
        entity: { type: "vacation", id: "v1" },
      }),
    );
  });

  it("una solicitud de vacaciones va a los aprobadores, no a operación", async () => {
    await notifyVacationRequested("v1", "Ana", "actor");

    expect(getVacationApprovers).toHaveBeenCalled();
    expect(operationsAudience).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.VACATION_REQUESTED,
      expect.objectContaining({
        recipients: ["appr-1"],
        entity: { type: "vacation", id: "v1" },
      }),
    );
  });

  it("la asignación actualizada conserva entidad y audiencia", async () => {
    await notifyAssignmentUpdated("a1", "Trabajo", ["u1"], "actor");

    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.ASSIGNMENT_UPDATED,
      expect.objectContaining({
        recipients: ["u1"],
        entity: { type: "assignment", id: "a1" },
      }),
    );
  });

  it("la difusión mapea system/announcement al tipo del catálogo", async () => {
    await notifyBroadcast("system", ["u1"], "Título", "Mensaje", "actor");
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.SYSTEM,
      expect.objectContaining({
        ctx: { title: "Título", message: "Mensaje" },
      }),
    );

    await notifyBroadcast("announcement", ["u1"], "T", "M", "actor");
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.ANNOUNCEMENT,
      expect.anything(),
    );
  });
});
