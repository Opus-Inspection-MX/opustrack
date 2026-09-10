import { EmailOutboxStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";
import { getMailTransport } from "./transport";

/**
 * The mail outbox: every event mail is a row before it is an attempt.
 *
 * `enqueueAndSend` inserts the row in PENDIENTE and tries to send it right
 * away. On success the row becomes ENVIADO; on failure it becomes FALLIDO
 * with `attempts++` and a `nextAttemptAt` backoff, so the Phase 5 cron can
 * pick it up with `retryDueEmails()` without any caller keeping state.
 *
 * Both entry points NEVER throw: mail is always the secondary channel, and a
 * mail problem must never roll back the business operation that triggered it.
 * `lastError` carries the failure KIND only — addresses and bodies are
 * stripped before persisting, so the outbox stays PII-free.
 */

/** Backoff between attempts: 5 min, 30 min, 2 h. */
export const EMAIL_RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

/** After this many attempts the row rests with `nextAttemptAt = null`. */
export const MAX_EMAIL_ATTEMPTS = 3;

export interface OutboxMessage {
  notificationType: string;
  subject: string;
  text: string;
  html: string;
  recipients: string[];
  broadcastId?: string;
}

/** Failure kind without PII: error name + scrubbed message, capped. */
export function sanitizeOutboxError(error: unknown): string {
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : `Error: ${String(error)}`;
  return raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[dirección]")
    .replace(/\+?\d[\d\s\-().]{6,}\d/g, "[teléfono]")
    .slice(0, 300);
}

interface OutboxRow {
  id: string;
  attempts: number;
}

async function attemptDelivery(row: OutboxRow): Promise<boolean> {
  const now = new Date();
  try {
    const full = await prisma.emailOutbox.findUniqueOrThrow({
      where: { id: row.id },
    });
    await getMailTransport().send({
      to: full.recipients,
      subject: full.subject,
      text: full.text,
      html: full.html,
    });
    await prisma.emailOutbox.update({
      where: { id: row.id },
      data: {
        status: EmailOutboxStatus.ENVIADO,
        lastError: null,
        nextAttemptAt: null,
      },
    });
    return true;
  } catch (error) {
    const attempts = row.attempts + 1;
    const lastError = sanitizeOutboxError(error);
    logger.error(
      `[mail:outbox] Intento ${attempts}/${MAX_EMAIL_ATTEMPTS} fallido:`,
      lastError,
    );
    try {
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: EmailOutboxStatus.FALLIDO,
          attempts,
          lastError,
          nextAttemptAt:
            attempts >= MAX_EMAIL_ATTEMPTS
              ? null
              : new Date(now.getTime() + EMAIL_RETRY_DELAYS_MS[attempts - 1]),
        },
      });
    } catch (updateError) {
      logger.error("[mail:outbox] No se pudo registrar el fallo:", updateError);
    }
    return false;
  }
}

/** Insert the row in PENDIENTE and try to send it immediately. */
export async function enqueueAndSend(message: OutboxMessage): Promise<void> {
  if (message.recipients.length === 0) return;
  try {
    const row = await prisma.emailOutbox.create({
      data: {
        notificationType: message.notificationType,
        subject: message.subject,
        text: message.text,
        html: message.html,
        recipients: message.recipients,
        status: EmailOutboxStatus.PENDIENTE,
        broadcastId: message.broadcastId ?? null,
      },
      select: { id: true, attempts: true },
    });
    await attemptDelivery(row);
  } catch (error) {
    logger.error("[mail:outbox] No se pudo encolar el correo:", error);
  }
}

export interface RetrySummary {
  attempted: number;
  sent: number;
  failed: number;
}

/**
 * Retry every row that is due: stuck PENDIENTE rows (created but never
 * attempted — e.g. a crash between insert and send) plus FALLIDO rows whose
 * `nextAttemptAt` passed and still have attempts left. Errors are isolated
 * per row so one poisoned message cannot block the rest.
 */
export async function retryDueEmails(
  now: Date = new Date(),
): Promise<RetrySummary> {
  const summary: RetrySummary = { attempted: 0, sent: 0, failed: 0 };
  try {
    const due = await prisma.emailOutbox.findMany({
      where: {
        OR: [
          { status: EmailOutboxStatus.PENDIENTE },
          {
            status: EmailOutboxStatus.FALLIDO,
            attempts: { lt: MAX_EMAIL_ATTEMPTS },
            nextAttemptAt: { lte: now },
          },
        ],
      },
      select: { id: true, attempts: true },
    });
    for (const row of due) {
      summary.attempted += 1;
      const sent = await attemptDelivery(row);
      if (sent) summary.sent += 1;
      else summary.failed += 1;
    }
  } catch (error) {
    logger.error("[mail:outbox] No se pudieron reintentar correos:", error);
  }
  return summary;
}
