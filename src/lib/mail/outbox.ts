import { EmailOutboxStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";
import { getMailTransport } from "./transport";

/**
 * The mail outbox: every event mail is a row before it is an attempt.
 *
 * `enqueueAndSend` inserts the row in PENDIENTE, claims it atomically
 * (PENDIENTE → ENVIANDO) and tries to send it right away. On success the row
 * becomes ENVIADO; on failure it becomes FALLIDO with `attempts++` and a
 * `nextAttemptAt` backoff, so the cron picks it up with `retryDueEmails()`
 * without any caller keeping state.
 *
 * Fase 5a (H-12): the claim is an `updateMany` conditioned on the `attempts`
 * value read from the due query — two overlapping workers (cron vs cron, or
 * cron vs `enqueueAndSend`) race on the same row and only the winner
 * (`count === 1`) sends. `retryDueEmails` only takes PENDIENTE rows older
 * than 2 minutes (fresh rows are still in flight inside `enqueueAndSend`)
 * and at most 50 rows per run. Rows stuck in ENVIANDO for over 15 minutes
 * (a crash between claim and send) fall back to FALLIDO so the next run
 * retries them instead of leaving them dead.
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

/**
 * A fresh PENDIENTE row is still in flight inside `enqueueAndSend`, so the
 * cron only takes PENDIENTE rows older than this.
 */
export const EMAIL_CLAIM_AGE_MS = 2 * 60_000;

/** Max rows claimed per `retryDueEmails` run (cron timeout budget). */
export const EMAIL_RETRY_BATCH = 50;

/** A crash between claim and send must not leave the row dead forever. */
export const EMAIL_STUCK_MS = 15 * 60_000;

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

/**
 * Atomic claim: move the row from a sendable state to ENVIANDO, but only
 * when `attempts` still matches the value read by the due query. Returns
 * true only for the worker that won the race (`count === 1`); every other
 * overlapping run must skip the row instead of sending a duplicate.
 */
async function claimRow(row: OutboxRow): Promise<boolean> {
  const claimed = await prisma.emailOutbox.updateMany({
    where: {
      id: row.id,
      attempts: row.attempts,
      status: { in: [EmailOutboxStatus.PENDIENTE, EmailOutboxStatus.FALLIDO] },
    },
    data: { status: EmailOutboxStatus.ENVIANDO },
  });
  return claimed.count === 1;
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

/** Insert the row in PENDIENTE, claim it, and try to send it immediately. */
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
    // The cron may already see this row: only the claim winner sends.
    if (!(await claimRow(row))) return;
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
 * attempted — e.g. a crash between insert and claim) plus FALLIDO rows whose
 * `nextAttemptAt` passed and still have attempts left. Fresh PENDIENTE rows
 * are excluded (still in flight inside `enqueueAndSend`), the batch is
 * capped, and every row is claimed atomically before sending so overlapping
 * runs deliver exactly once. Rows stuck in ENVIANDO past the crash window
 * fall back to FALLIDO first. Errors are isolated per row so one poisoned
 * message cannot block the rest.
 */
export async function retryDueEmails(
  now: Date = new Date(),
): Promise<RetrySummary> {
  const summary: RetrySummary = { attempted: 0, sent: 0, failed: 0 };
  try {
    // A crash between claim and send leaves ENVIANDO rows no worker owns.
    // Send them back to FALLIDO due now so this run retries them; each step
    // below is isolated so a pre-migration database (no ENVIANDO value yet)
    // degrades to a logged error instead of starving the whole run.
    try {
      await prisma.emailOutbox.updateMany({
        where: {
          status: EmailOutboxStatus.ENVIANDO,
          updatedAt: { lt: new Date(now.getTime() - EMAIL_STUCK_MS) },
        },
        data: { status: EmailOutboxStatus.FALLIDO, nextAttemptAt: now },
      });
    } catch (error) {
      logger.error("[mail:outbox] No se pudieron recuperar envíos atascados:", error);
    }
    const due = await prisma.emailOutbox.findMany({
      where: {
        OR: [
          {
            status: EmailOutboxStatus.PENDIENTE,
            createdAt: { lte: new Date(now.getTime() - EMAIL_CLAIM_AGE_MS) },
          },
          {
            status: EmailOutboxStatus.FALLIDO,
            attempts: { lt: MAX_EMAIL_ATTEMPTS },
            nextAttemptAt: { lte: now },
          },
        ],
      },
      select: { id: true, attempts: true },
      take: EMAIL_RETRY_BATCH,
    });
    for (const row of due) {
      if (!(await claimRow(row))) continue;
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
