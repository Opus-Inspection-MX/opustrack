import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, sendMail, getUserIdsWithPermission } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn() },
  },
  sendMail: vi.fn(),
  getUserIdsWithPermission: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/mail", () => ({ sendMail }));
vi.mock("@/lib/authz/user-queries", () => ({ getUserIdsWithPermission }));

import {
  getOperationsAudience,
  getVacationApprovers,
  notifyAssignmentUpdated,
  notifyIncidentClosed,
  notifyIncidentCreated,
  notifyVacationRequested,
} from "./notify-events";

/**
 * Who gets told, and who gets mailed.
 *
 * Both rules broke silently once already: a single shared "admins" list sent
 * vacation requests to the operations administrators — who cannot approve them
 * — while the approvers heard nothing. Nothing failed; the request simply sat
 * there. These tests pin the audiences to the CAPABILITY, not to a role name.
 */

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notification.createMany.mockResolvedValue({ count: 1 });
  prismaMock.user.findMany.mockResolvedValue([
    { email: "ops@opusinspection.com" },
  ]);
  getUserIdsWithPermission.mockResolvedValue(["u1"]);
});

describe("audiencias", () => {
  it("operación se resuelve por incidents:update", async () => {
    await getOperationsAudience();
    expect(getUserIdsWithPermission).toHaveBeenCalledWith("incidents:update");
  });

  it("vacaciones se resuelve por vacations:approve", async () => {
    await getVacationApprovers();
    expect(getUserIdsWithPermission).toHaveBeenCalledWith("vacations:approve");
  });

  it("una solicitud de vacaciones NO va a la audiencia de operación", async () => {
    await notifyVacationRequested("v1", "Ana", "actor");

    // The regression this file exists for.
    expect(getUserIdsWithPermission).toHaveBeenCalledWith("vacations:approve");
    expect(getUserIdsWithPermission).not.toHaveBeenCalledWith(
      "incidents:update",
    );
  });

  it("un incidente nuevo NO va a los aprobadores de vacaciones", async () => {
    await notifyIncidentCreated(7, "Bomba fuera de servicio", "actor");

    expect(getUserIdsWithPermission).toHaveBeenCalledWith("incidents:update");
    expect(getUserIdsWithPermission).not.toHaveBeenCalledWith(
      "vacations:approve",
    );
  });
});

describe("correo", () => {
  it("un incidente nuevo se manda por correo a los destinatarios", async () => {
    await notifyIncidentCreated(7, "Bomba fuera de servicio", "actor");

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["ops@opusinspection.com"],
        subject: expect.stringContaining("Bomba fuera de servicio"),
      }),
    );
  });

  it("el cierre de un incidente también", async () => {
    await notifyIncidentClosed(7, "Bomba fuera de servicio", null, "actor");

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("resuelto"),
      }),
    );
  });

  it("la solicitud de vacaciones nombra a quien la pide", async () => {
    await notifyVacationRequested("v1", "Ana Pérez", "actor");

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Ana Pérez"),
      }),
    );
  });

  it("los eventos que NO lo declaran no mandan correo", async () => {
    // Mailing every notification would put a message in the inbox on each edit,
    // and a sender that mails too much gets filtered — taking the three that
    // matter with it.
    await notifyAssignmentUpdated("a1", "Trabajo", ["u1"], "actor");

    expect(prismaMock.notification.createMany).toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sin destinatarios no escribe ni manda nada", async () => {
    getUserIdsWithPermission.mockResolvedValue([]);

    await notifyIncidentCreated(7, "Sin público", "actor");

    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("excluye al actor antes de mandar", async () => {
    getUserIdsWithPermission.mockResolvedValue(["actor"]);

    await notifyIncidentCreated(7, "Yo mismo", "actor");

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("un fallo al resolver correos no tumba la notificación", async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error("db caída"));

    await expect(
      notifyIncidentCreated(7, "Bomba", "actor"),
    ).resolves.toBeUndefined();

    // The in-app notification was still written: mail is the secondary channel.
    expect(prismaMock.notification.createMany).toHaveBeenCalled();
  });
});
