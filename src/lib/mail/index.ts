import {
  createSmtpTransport,
  type MailMessage,
  type MailTransport,
  noopTransport,
} from "./transport";

export type { MailMessage, MailTransport };

/**
 * The one place that decides how mail leaves the app.
 *
 * Memoized because `nodemailer.createTransport` opens a connection pool, and
 * building one per notification would leak sockets under load.
 */
let cached: MailTransport | null = null;

export function getMailTransport(): MailTransport {
  if (cached) return cached;
  cached = process.env.SMTP_HOST ? createSmtpTransport() : noopTransport;
  return cached;
}

/** Drop the memoized transport. For tests that swap the environment. */
export function resetMailTransport(): void {
  cached = null;
}

/**
 * Send, and never let a mail problem break the operation that triggered it.
 *
 * Same rule the in-app notifications already follow: an incident must not fail
 * to be created because the mail server is down. The failure is logged loudly
 * so a broken configuration is visible in the server log rather than silent.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (message.to.length === 0) return;

  try {
    await getMailTransport().send(message);
  } catch (error) {
    console.error(
      `[mail] No se pudo enviar "${message.subject}" a ${message.to.length} destinatario(s):`,
      error,
    );
  }
}
