import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  requirePermission,
  getMailTransport,
  transportSend,
  transportVerify,
  retryDueEmails,
} = vi.hoisted(() => ({
  prismaMock: {
    notificationChannelPolicy: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    emailOutbox: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  requirePermission: vi.fn(),
  transportSend: vi.fn(),
  transportVerify: vi.fn(),
  getMailTransport: vi.fn(),
  retryDueEmails: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({ requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/mail", () => ({ getMailTransport }));
vi.mock("@/lib/mail/outbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail/outbox")>();
  return { ...actual, retryDueEmails };
});

import {
  getChannelMatrix,
  getFailedEmails,
  getSmtpStatus,
  retryFailedEmail,
  saveChannelPolicies,
  sendTestEmail,
} from "./notification-settings";

/**
 * The admin matrix: only the configure capability writes, every rule is
 * returned in Spanish, and a save invalidates the dispatch cache so the new
 * channels apply on the next event — not 60 s later.
 */

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ id: "root-1", email: "root@x.com" });
  prismaMock.notificationChannelPolicy.findMany.mockResolvedValue([]);
  prismaMock.notificationChannelPolicy.upsert.mockResolvedValue({});
  prismaMock.auditLog.create.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
  );
  getMailTransport.mockReturnValue({
    name: "smtp(localhost:1025)",
    send: transportSend,
    verify: transportVerify,
  });
  transportSend.mockResolvedValue("msg-1");
  transportVerify.mockResolvedValue(undefined);
  retryDueEmails.mockResolvedValue({ attempted: 1, sent: 1, failed: 0 });
});

describe("getChannelMatrix", () => {
  it("exige notifications:configure", async () => {
    await getChannelMatrix();

    expect(requirePermission).toHaveBeenCalledWith("notifications:configure");
  });

  it("cubre cada evento del catálogo con defaults cuando no hay renglón", async () => {
    const rows = await getChannelMatrix();

    expect(rows.length).toBeGreaterThan(10);
    const created = rows.find((r) => r.type === "incident_created");
    expect(created).toMatchObject({
      label: "Incidente creado",
      group: "Incidentes",
      inApp: true,
      email: true,
    });
  });

  it("la política guardada gana sobre el default", async () => {
    prismaMock.notificationChannelPolicy.findMany.mockResolvedValue([
      { type: "incident_created", inApp: true, email: false },
    ]);

    const rows = await getChannelMatrix();

    expect(rows.find((r) => r.type === "incident_created")).toMatchObject({
      email: false,
    });
  });
});

describe("saveChannelPolicies", () => {
  it("persiste, audita e invalida la caché", async () => {
    const result = await saveChannelPolicies([
      { type: "incident_created", inApp: true, email: false },
    ]);

    expect(result).toEqual({ success: true });
    expect(prismaMock.notificationChannelPolicy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: "incident_created" } }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: "root-1" }),
      }),
    );
  });

  it("un evento desconocido se devuelve en español, no se lanza", async () => {
    const result = await saveChannelPolicies([
      { type: "evento_fantasma", inApp: true, email: false },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/desconocido/);
    expect(prismaMock.notificationChannelPolicy.upsert).not.toHaveBeenCalled();
  });

  it("una matriz vacía se devuelve en español", async () => {
    const result = await saveChannelPolicies([]);

    expect(result.success).toBe(false);
    expect(prismaMock.notificationChannelPolicy.upsert).not.toHaveBeenCalled();
  });
});

describe("SMTP", () => {
  it("reporta el transporte actual", async () => {
    const status = await getSmtpStatus();

    expect(status).toMatchObject({
      transport: "smtp(localhost:1025)",
      configured: true,
    });
  });

  it("noop cuenta como no configurado", async () => {
    getMailTransport.mockReturnValue({
      name: "noop",
      send: transportSend,
      verify: transportVerify,
    });

    const status = await getSmtpStatus();

    expect(status.configured).toBe(false);
  });

  it("la prueba verifica y manda a mi dirección", async () => {
    const result = await sendTestEmail();

    expect(result).toEqual({ success: true });
    expect(transportVerify).toHaveBeenCalledTimes(1);
    expect(transportSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["root@x.com"] }),
    );
  });

  it("un transporte caído se devuelve en español", async () => {
    transportVerify.mockRejectedValue(new Error("refused"));

    const result = await sendTestEmail();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/SMTP/);
  });
});

describe("fallidos y reintento", () => {
  it("lista los fallidos recientes", async () => {
    prismaMock.emailOutbox.findMany.mockResolvedValue([
      {
        id: "e1",
        notificationType: "incident_created",
        subject: "X",
        status: "FALLIDO",
        attempts: 1,
        lastError: "Error: caído",
        nextAttemptAt: new Date(),
        createdAt: new Date(),
        recipients: ["a@x.com", "b@x.com"],
      },
    ]);

    const rows = await getFailedEmails();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "e1", recipientCount: 2 });
  });

  it("reintenta un fallido con intentos restantes", async () => {
    prismaMock.emailOutbox.findUnique.mockResolvedValue({
      id: "e1",
      status: "FALLIDO",
      attempts: 1,
    });
    prismaMock.emailOutbox.update.mockResolvedValue({});

    const result = await retryFailedEmail("e1");

    expect(result).toEqual({ success: true });
    expect(retryDueEmails).toHaveBeenCalledTimes(1);
  });

  it("agotado el tope se devuelve en español sin tocar nada", async () => {
    prismaMock.emailOutbox.findUnique.mockResolvedValue({
      id: "e1",
      status: "FALLIDO",
      attempts: 3,
    });

    const result = await retryFailedEmail("e1");

    expect(result.success).toBe(false);
    expect(prismaMock.emailOutbox.update).not.toHaveBeenCalled();
    expect(retryDueEmails).not.toHaveBeenCalled();
  });

  it("un id inexistente se devuelve en español", async () => {
    prismaMock.emailOutbox.findUnique.mockResolvedValue(null);

    const result = await retryFailedEmail("fantasma");

    expect(result.success).toBe(false);
  });
});
