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
vi.mock("@/lib/authz/user-queries", async (importOriginal) => {
  // The audience under test is a real Prisma `where` built with the real
  // helper — only the DB round-trip (getUserIdsWithPermission) is faked, so
  // the assertions below pin the actual fragment, not a mock of it.
  const actual =
    await importOriginal<typeof import("@/lib/authz/user-queries")>();
  return { ...actual, getUserIdsWithPermission };
});

import {
  getVacationApprovers,
  notifyAssignmentUpdated,
  notifyIncidentClosed,
  notifyIncidentCreated,
  notifyVacationRequested,
  operationsAudience,
} from "./notify-events";

/**
 * Who gets told, and who gets mailed.
 *
 * Both rules broke silently once already: a single shared "admins" list sent
 * vacation requests to the operations administrators — who cannot approve them
 * — while the approvers heard nothing; and `incidents:update` mailed every new
 * incident to every FSR in every Client. These tests pin the audiences to the
 * CAPABILITY plus the Client scope, not to a role name.
 */

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notification.createMany.mockResolvedValue({ count: 1 });
  prismaMock.user.findMany.mockResolvedValue([
    { email: "ops@opusinspection.com" },
  ]);
  getUserIdsWithPermission.mockResolvedValue(["u1"]);
});

/**
 * The audience lookup is the `findMany` whose `where` carries the OR branch
 * (scope holder vs. Client assignment). Later calls in the same flow resolve
 * mail addresses by id and must not be mistaken for it.
 */
function audienceWhere(): string {
  const call = prismaMock.user.findMany.mock.calls.find(
    (args: Array<{ where?: object }>) =>
      args?.[0]?.where !== undefined &&
      "OR" in (args[0].where as Record<string, unknown>),
  );
  return JSON.stringify(call?.[0]?.where ?? {});
}

function lastUserWhere(): string {
  const call = prismaMock.user.findMany.mock.calls.at(-1);
  return JSON.stringify(call?.[0]?.where ?? {});
}

describe("audiencias", () => {
  it("operación exige incidents:assign, nunca incidents:update", async () => {
    await operationsAudience("c1");

    const where = lastUserWhere();
    expect(where).toContain("incidents:assign");
    expect(where).not.toContain("incidents:update");
  });

  it("operación alcanza al Cliente por alcance global o por asignación", async () => {
    await operationsAudience("c1");

    const where = lastUserWhere();
    expect(where).toContain("scope:all-clients");
    expect(where).toContain("c1");
  });

  it("sin Cliente solo llega al alcance global (fail closed)", async () => {
    await operationsAudience(null);

    const where = lastUserWhere();
    expect(where).toContain("scope:all-clients");
    expect(where).not.toContain("clientAssignments");
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
    await notifyIncidentCreated(7, "Bomba fuera de servicio", "actor", "c1");

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              clientAssignments: {
                some: { active: true, clientId: "c1" },
              },
            }),
          ]),
        }),
      }),
    );
    expect(getUserIdsWithPermission).not.toHaveBeenCalledWith(
      "vacations:approve",
    );
  });

  it("el cierre propaga el Cliente a la audiencia", async () => {
    await notifyIncidentClosed(
      7,
      "Bomba fuera de servicio",
      null,
      "actor",
      "c9",
    );

    expect(audienceWhere()).toContain("c9");
  });
});

describe("correo", () => {
  it("un incidente nuevo se manda por correo a los destinatarios", async () => {
    await notifyIncidentCreated(7, "Bomba fuera de servicio", "actor", "c1");

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["ops@opusinspection.com"],
        subject: expect.stringContaining("Bomba fuera de servicio"),
      }),
    );
  });

  it("el cierre de un incidente también", async () => {
    await notifyIncidentClosed(
      7,
      "Bomba fuera de servicio",
      null,
      "actor",
      "c1",
    );

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
    prismaMock.user.findMany.mockResolvedValue([]);

    await notifyIncidentCreated(7, "Sin público", "actor", "c1");

    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("excluye al actor antes de mandar", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "actor" }]);

    await notifyIncidentCreated(7, "Yo mismo", "actor", "c1");

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("un fallo en la audiencia no tumba la operación", async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error("db caída"));

    await expect(
      notifyIncidentCreated(7, "Bomba", "actor", "c1"),
    ).resolves.toBeUndefined();

    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("un fallo al resolver correos no tumba la notificación", async () => {
    // Audience resolves, mail resolution fails: the in-app write survives.
    prismaMock.user.findMany
      .mockResolvedValueOnce([{ id: "u1" }])
      .mockRejectedValueOnce(new Error("db caída"));

    await expect(
      notifyIncidentCreated(7, "Bomba", "actor", "c1"),
    ).resolves.toBeUndefined();

    // The in-app notification was still written: mail is the secondary channel.
    expect(prismaMock.notification.createMany).toHaveBeenCalled();
  });
});
