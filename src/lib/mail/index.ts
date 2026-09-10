import { logger } from "@/lib/observability/logger";
import {
  getMailTransport,
  type MailMessage,
  type MailTransport,
  resetMailTransport,
} from "./transport";

export type { MailMessage, MailTransport };
export { getMailTransport, resetMailTransport };

/**
 * Send, and never let a mail problem break the operation that triggered it.
 *
 * Same rule the in-app notifications already follow: an incident must not fail
 * to be created because the mail server is down. The failure is logged loudly
 * so a broken configuration is visible in the server log rather than silent.
 *
 * Prefer the outbox (`./outbox`) for event mail — it records the attempt and
 * retries. This stays for the settings test-mail button, where the caller
 * wants the outcome inline.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (message.to.length === 0) return;

  try {
    await getMailTransport().send(message);
  } catch (error) {
    logger.error(
      `[mail] No se pudo enviar "${message.subject}" a ${message.to.length} destinatario(s):`,
      error,
    );
  }
}
