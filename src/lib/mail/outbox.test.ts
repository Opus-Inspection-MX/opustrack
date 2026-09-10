import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, transportSend } = vi.hoisted(() => ({
  prismaMock: {
    emailOutbox: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
  transportSend: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("./transport", () => ({
  getMailTransport: () => ({
    name: "mock",
    send: transportSend,
    verify: vi.fn(async () => {}),
  }),
}));

import { EmailOutboxStatus } from "@prisma/client";
import {
  EMAIL_RETRY_DELAYS_MS,
  enqueueAndSend,
  MAX_EMAIL_ATTEMPTS,
  retryDueEmails,
  sanitizeOutboxError,
} from "./outbox";

/**
 * The outbox is the reason a mail-server outage is a backlog, not data loss.
 * These tests pin the retry math (backoff, cap) and the PII rule, plus the
 * blanket guarantee: mail never breaks the operation that triggered it.
 */

const MESSAGE = {
  notificationType: "incident_created",
  subject: "Nuevo incidente reportado: Bomba",
  text: "Se reportó un nuevo incidente: Bomba.",
  html: "<p>Se reportó un nuevo incidente: Bomba.</p>",
  recipients: ["ops@opusinspection.com"],
};

beforeEach(() => {
  vi.clearAllMocks();
  transportSend.mockReset();
  transportSend.mockResolvedValue("msg-1");
  prismaMock.emailOutbox.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: "row-1",
      attempts: 0,
      ...args.data,
    }),
  );
  prismaMock.emailOutbox.findUniqueOrThrow.mockResolvedValue({
    id: "row-1",
    ...MESSAGE,
  });
  prismaMock.emailOutbox.update.mockResolvedValue({});
  prismaMock.emailOutbox.findMany.mockResolvedValue([]);
});

describe("enqueueAndSend", () => {
  it("encola en PENDIENTE y marca ENVIADO cuando el envío sale", async () => {
    await enqueueAndSend(MESSAGE);

    expect(prismaMock.emailOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailOutboxStatus.PENDIENTE,
          recipients: MESSAGE.recipients,
        }),
      }),
    );
    expect(transportSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: MESSAGE.recipients }),
    );
    expect(prismaMock.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailOutboxStatus.ENVIADO,
        }),
      }),
    );
  });

  it("sin destinatarios no escribe nada", async () => {
    await enqueueAndSend({ ...MESSAGE, recipients: [] });

    expect(prismaMock.emailOutbox.create).not.toHaveBeenCalled();
    expect(transportSend).not.toHaveBeenCalled();
  });

  it("un fallo marca FALLIDO con attempts++ y reintento en 5 minutos", async () => {
    transportSend.mockRejectedValue(new Error("conexión rechazada"));
    const before = Date.now();

    await enqueueAndSend(MESSAGE);

    const update = prismaMock.emailOutbox.update.mock.calls[0][0];
    expect(update.data.status).toBe(EmailOutboxStatus.FALLIDO);
    expect(update.data.attempts).toBe(1);
    const next = (update.data.nextAttemptAt as Date).getTime();
    expect(next - before).toBeGreaterThanOrEqual(
      EMAIL_RETRY_DELAYS_MS[0] - 5000,
    );
    expect(next - before).toBeLessThanOrEqual(EMAIL_RETRY_DELAYS_MS[0] + 5000);
  });

  it("el backoff progresa 5min → 30min → 2h y se detiene en el tope", async () => {
    transportSend.mockRejectedValue(new Error("caído"));
    const seen: Array<Date | null> = [];
    prismaMock.emailOutbox.update.mockImplementation(
      async (args: { data: { nextAttemptAt: Date | null } }) => {
        seen.push(args.data.nextAttemptAt);
        return {};
      },
    );

    for (const attempts of [0, 1, 2]) {
      prismaMock.emailOutbox.findUniqueOrThrow.mockResolvedValueOnce({
        id: "row-1",
        ...MESSAGE,
      });
      await retryDueEmailsWithRow(attempts);
    }

    const gaps = seen.map((d) => (d ? d.getTime() - Date.now() : null));
    expect(gaps[0]).toBeGreaterThan(4 * 60_000);
    expect(gaps[0]).toBeLessThan(6 * 60_000);
    expect(gaps[1]).toBeGreaterThan(29 * 60_000);
    expect(gaps[1]).toBeLessThan(31 * 60_000);
    // Third failure hits the cap: no further retry scheduled.
    expect(seen[2]).toBeNull();
    expect(MAX_EMAIL_ATTEMPTS).toBe(3);
  });

  it("un fallo de la BD al encolar no propaga", async () => {
    prismaMock.emailOutbox.create.mockRejectedValue(new Error("db caída"));

    await expect(enqueueAndSend(MESSAGE)).resolves.toBeUndefined();
  });
});

/** Drive one retry for a row that already failed `attempts` times. */
async function retryDueEmailsWithRow(attempts: number): Promise<void> {
  prismaMock.emailOutbox.findMany.mockResolvedValueOnce([
    { id: "row-1", attempts },
  ]);
  await retryDueEmails();
}

describe("retryDueEmails", () => {
  it("reintenta lo vencido y resume lo logrado", async () => {
    prismaMock.emailOutbox.findMany.mockResolvedValue([
      { id: "r1", attempts: 1 },
      { id: "r2", attempts: 1 },
    ]);
    transportSend
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("sigue caído"));
    prismaMock.emailOutbox.findUniqueOrThrow.mockResolvedValue({
      id: "r",
      ...MESSAGE,
    });

    const summary = await retryDueEmails();

    expect(summary).toMatchObject({ attempted: 2, sent: 1, failed: 1 });
  });

  it("sin vencidos no intenta nada", async () => {
    const summary = await retryDueEmails();

    expect(summary).toMatchObject({ attempted: 0, sent: 0, failed: 0 });
    expect(transportSend).not.toHaveBeenCalled();
  });

  it("un fallo al listar no propaga y resume en ceros", async () => {
    prismaMock.emailOutbox.findMany.mockRejectedValue(new Error("db caída"));

    const summary = await retryDueEmails();

    expect(summary).toMatchObject({ attempted: 0, sent: 0, failed: 0 });
  });
});

describe("lastError sin PII", () => {
  it("oculta direcciones y teléfonos del mensaje de error", () => {
    const scrubbed = sanitizeOutboxError(
      new Error(
        "5.1.1 <ops@opusinspection.com>: sin buzón, llame al +52 55 1234 5678",
      ),
    );

    expect(scrubbed).not.toContain("ops@opusinspection.com");
    expect(scrubbed).not.toContain("55 1234 5678");
    expect(scrubbed).toContain("[dirección]");
  });

  it("persiste el error saneado, nunca el original", async () => {
    transportSend.mockRejectedValue(
      new Error("falló para admin@opusinspection.com"),
    );

    await enqueueAndSend(MESSAGE);

    const update = prismaMock.emailOutbox.update.mock.calls[0][0];
    expect(update.data.lastError).not.toContain("admin@opusinspection.com");
  });
});
