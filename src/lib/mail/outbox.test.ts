import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, transportSend } = vi.hoisted(() => ({
  prismaMock: {
    emailOutbox: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
  prismaMock.emailOutbox.updateMany.mockResolvedValue({ count: 1 });
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

/**
 * Fase 5a (H-12): atomic claim + bounded batch + stuck recovery.
 *
 * Two overlapping cron runs (or `enqueueAndSend` racing the cron) must send
 * each row once: every send is preceded by an atomic PENDIENTE/FALLIDO →
 * ENVIANDO claim conditioned on the read `attempts`, and the mail goes out
 * only when the claim wins (`count === 1`).
 *
 * No integration infra exists on main yet (Fase 2), so these pin the contract
 * against the mocked delegate.
 * TODO(int): promote to concurrency.int.test.ts once Fase 2 infra lands.
 */
describe("Fase 5a: atomic email claim", () => {
  it("retryDueEmails solo toma PENDIENTE con más de 2 min y lote de 50", async () => {
    await retryDueEmails();

    expect(prismaMock.emailOutbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: EmailOutboxStatus.PENDIENTE,
              createdAt: expect.objectContaining({ lte: expect.any(Date) }),
            }),
          ]),
        }),
      }),
    );
    const cutoff =
      prismaMock.emailOutbox.findMany.mock.calls[0][0].where.OR.find(
        (branch: Record<string, unknown>) =>
          branch.status === EmailOutboxStatus.PENDIENTE,
      ).createdAt.lte as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
      2 * 60_000 - 5000,
    );
  });

  it("reclama PENDIENTE→ENVIANDO condicionado a attempts y solo envía si gana", async () => {
    prismaMock.emailOutbox.findMany.mockResolvedValue([
      { id: "r1", attempts: 1 },
    ]);
    prismaMock.emailOutbox.updateMany.mockResolvedValue({ count: 1 });

    await retryDueEmails();

    expect(prismaMock.emailOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "r1",
          attempts: 1,
          status: expect.objectContaining({
            in: expect.arrayContaining([
              EmailOutboxStatus.PENDIENTE,
              EmailOutboxStatus.FALLIDO,
            ]),
          }),
        }),
        data: expect.objectContaining({
          status: EmailOutboxStatus.ENVIANDO,
        }),
      }),
    );
    expect(transportSend).toHaveBeenCalledTimes(1);
  });

  it("si otro worker ganó el claim (count 0) no envía", async () => {
    prismaMock.emailOutbox.findMany.mockResolvedValue([
      { id: "r1", attempts: 1 },
    ]);
    prismaMock.emailOutbox.updateMany.mockResolvedValue({ count: 0 });

    const summary = await retryDueEmails();

    expect(transportSend).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ attempted: 0, sent: 0, failed: 0 });
  });

  it("devuelve a FALLIDO las filas atascadas en ENVIANDO más de 15 min", async () => {
    await retryDueEmails();

    expect(prismaMock.emailOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: EmailOutboxStatus.ENVIANDO,
          updatedAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
        data: expect.objectContaining({
          status: EmailOutboxStatus.FALLIDO,
        }),
      }),
    );
  });

  it("enqueueAndSend reclama su fila antes de enviar; sin claim no hay envío", async () => {
    prismaMock.emailOutbox.updateMany.mockResolvedValue({ count: 0 });

    await enqueueAndSend(MESSAGE);

    expect(prismaMock.emailOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailOutboxStatus.ENVIANDO,
        }),
      }),
    );
    expect(transportSend).not.toHaveBeenCalled();
  });

  it("dos retryDueEmails en paralelo envían una sola vez (conteo de transporte)", async () => {
    prismaMock.emailOutbox.findMany.mockResolvedValue([
      { id: "r1", attempts: 0 },
    ]);
    let claims = 0;
    prismaMock.emailOutbox.updateMany.mockImplementation(
      async (args: { data: { status: unknown } }) => {
        if (args.data.status !== EmailOutboxStatus.ENVIANDO) {
          return { count: 0 }; // stuck-row requeue: nothing stuck in this test
        }
        claims += 1;
        // First claim wins, second loses — the atomic race.
        return { count: claims === 1 ? 1 : 0 };
      },
    );
    // Slow transport so both runs overlap inside attemptDelivery.
    transportSend.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("ok"), 20)),
    );

    const [first, second] = await Promise.all([
      retryDueEmails(),
      retryDueEmails(),
    ]);

    expect(transportSend).toHaveBeenCalledTimes(1);
    expect(first.sent + second.sent).toBe(1);
  });
});
