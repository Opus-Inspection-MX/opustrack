import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, enqueueAndSend } = vi.hoisted(() => ({
  prismaMock: {
    notificationChannelPolicy: { findMany: vi.fn() },
    notification: { createMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
  enqueueAndSend: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/mail/outbox", () => ({ enqueueAndSend }));

import {
  clearChannelPolicyCache,
  dispatch,
  getEventChannels,
} from "./dispatch";
import { NOTIFICATION_TYPES } from "./notification-types";

/**
 * The funnel guarantee: the matrix decides, the actor is excluded, and
 * nothing ever throws — whatever the database or the mailer does.
 */

const CTX = { incidentId: 7, incidentTitle: "Bomba fuera de servicio" };

function seedPolicy(inApp: boolean, email: boolean) {
  prismaMock.notificationChannelPolicy.findMany.mockResolvedValue([
    { type: NOTIFICATION_TYPES.INCIDENT_CREATED, inApp, email },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  clearChannelPolicyCache();
  enqueueAndSend.mockResolvedValue(undefined);
  prismaMock.notification.createMany.mockResolvedValue({ count: 2 });
  prismaMock.user.findMany.mockResolvedValue([
    { email: "ops@opusinspection.com" },
  ]);
});

describe("matriz de canales", () => {
  it("respeta in-app apagado: no escribe notificaciones", async () => {
    seedPolicy(false, true);

    await dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
      recipients: ["u1", "u2"],
      actorId: "actor",
      ctx: CTX,
    });

    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(enqueueAndSend).toHaveBeenCalledTimes(1);
  });

  it("respeta correo apagado: no encola nada", async () => {
    seedPolicy(true, false);

    await dispatch(NOTIFICATION_TYPES.ASSIGNMENT_UPDATED, {
      recipients: ["u1"],
      actorId: "actor",
      ctx: { assignmentId: "a1", incidentTitle: "Trabajo" },
    });

    expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
    expect(enqueueAndSend).not.toHaveBeenCalled();
  });

  it("los dos apagados deshabilitan el evento", async () => {
    seedPolicy(false, false);

    await dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
      recipients: ["u1"],
      actorId: "actor",
      ctx: CTX,
    });

    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(enqueueAndSend).not.toHaveBeenCalled();
  });

  it("sin renglón de política usa los defaults del catálogo", async () => {
    prismaMock.notificationChannelPolicy.findMany.mockResolvedValue([]);

    // incident_created mails by default; assignment_updated does not.
    await dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
      recipients: ["u1"],
      actorId: "actor",
      ctx: CTX,
    });
    expect(enqueueAndSend).toHaveBeenCalledTimes(1);

    await dispatch(NOTIFICATION_TYPES.ASSIGNMENT_UPDATED, {
      recipients: ["u1"],
      actorId: "actor",
      ctx: { assignmentId: "a1" },
    });
    expect(enqueueAndSend).toHaveBeenCalledTimes(1);
  });

  it("el correo encola asunto y cuerpo del catálogo con el HTML", async () => {
    seedPolicy(true, true);

    await dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
      recipients: ["u1"],
      actorId: "actor",
      ctx: CTX,
    });

    expect(enqueueAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationType: "incident_created",
        subject: expect.stringContaining("Bomba fuera de servicio"),
        html: expect.stringContaining("OpusTrack"),
        recipients: ["ops@opusinspection.com"],
      }),
    );
  });
});

describe("audiencia", () => {
  it("excluye al actor y deduplica", async () => {
    seedPolicy(true, false);

    await dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
      recipients: ["u1", "actor", "u1", "u2"],
      actorId: "actor",
      ctx: CTX,
    });

    const data = prismaMock.notification.createMany.mock.calls[0][0].data;
    const ids = data.map((d: { userId: string }) => d.userId).sort();
    expect(ids).toEqual(["u1", "u2"]);
  });

  it("includeActor conserva al actor (copia al remitente)", async () => {
    seedPolicy(true, false);

    await dispatch(NOTIFICATION_TYPES.SYSTEM, {
      recipients: ["actor"],
      actorId: "actor",
      ctx: { title: "Aviso", message: "Hola" },
      includeActor: true,
    });

    expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it("sin destinatarios no escribe ni encola nada", async () => {
    seedPolicy(true, true);

    await dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
      recipients: ["actor"],
      actorId: "actor",
      ctx: CTX,
    });

    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(enqueueAndSend).not.toHaveBeenCalled();
  });
});

describe("nunca lanza", () => {
  it("un fallo cargando la política usa defaults y sigue", async () => {
    prismaMock.notificationChannelPolicy.findMany.mockRejectedValue(
      new Error("db caída"),
    );

    await expect(
      dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
        recipients: ["u1"],
        actorId: "actor",
        ctx: CTX,
      }),
    ).resolves.toBeUndefined();

    // Catalog default for incident_created is in-app on.
    expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it("un fallo en in-app no cancela el correo", async () => {
    seedPolicy(true, true);
    prismaMock.notification.createMany.mockRejectedValue(new Error("db caída"));

    await expect(
      dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
        recipients: ["u1"],
        actorId: "actor",
        ctx: CTX,
      }),
    ).resolves.toBeUndefined();

    expect(enqueueAndSend).toHaveBeenCalledTimes(1);
  });

  it("un fallo resolviendo correos no tumba la notificación", async () => {
    seedPolicy(true, true);
    prismaMock.user.findMany.mockRejectedValue(new Error("db caída"));

    await expect(
      dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
        recipients: ["u1"],
        actorId: "actor",
        ctx: CTX,
      }),
    ).resolves.toBeUndefined();

    expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it("un fallo del outbox no propaga", async () => {
    seedPolicy(true, true);
    enqueueAndSend.mockRejectedValue(new Error("outbox caído"));

    await expect(
      dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
        recipients: ["u1"],
        actorId: "actor",
        ctx: CTX,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("caché de política", () => {
  it("cachea 60s y clearChannelPolicyCache invalida", async () => {
    seedPolicy(true, false);

    await getEventChannels(NOTIFICATION_TYPES.INCIDENT_CREATED);
    await getEventChannels(NOTIFICATION_TYPES.INCIDENT_CREATED);

    expect(prismaMock.notificationChannelPolicy.findMany).toHaveBeenCalledTimes(
      1,
    );

    clearChannelPolicyCache();
    await getEventChannels(NOTIFICATION_TYPES.INCIDENT_CREATED);

    expect(prismaMock.notificationChannelPolicy.findMany).toHaveBeenCalledTimes(
      2,
    );
  });
});
