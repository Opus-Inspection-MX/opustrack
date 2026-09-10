import nodemailer from "nodemailer";
import { logger } from "@/lib/observability/logger";
import { toHtml } from "./templates";

/**
 * Outbound email, behind one interface.
 *
 * Same shape as `file-storage.ts`: the provider is chosen from the environment
 * in exactly one place, so the callers never learn whether a real mail server
 * exists. That is what lets `npm run dev` and the unit tests run with no
 * configuration at all, and the e2e suite point at a throwaway Mailpit.
 */

export interface MailMessage {
  /** Recipients. Sent as a single BCC message, never one email per person. */
  to: string[];
  subject: string;
  /** Plain-text body. The HTML part is derived from it when absent. */
  text: string;
  /** Rich body (the catalog layout). Falls back to the escaped text. */
  html?: string;
}

export interface MailTransport {
  readonly name: string;
  /** Throws on failure — the OUTBOX decides what a failure means. */
  send(message: MailMessage): Promise<string | undefined>;
  /** Check the connection without sending. Throws when unreachable. */
  verify(): Promise<void>;
}

/**
 * Does nothing but say so.
 *
 * Chosen whenever `SMTP_HOST` is absent, which is the normal state of a
 * developer machine and of the unit tests. Failing instead would make every
 * incident creation blow up on a laptop, and turning it into a silent no-op
 * would hide a misconfigured production deploy — so it logs.
 */
export const noopTransport: MailTransport = {
  name: "noop",
  async send(message) {
    logger.info(
      `[mail:noop] Sin SMTP_HOST — no se envió "${message.subject}" a ${message.to.length} destinatario(s)`,
    );
    return undefined;
  },
  async verify() {},
};

export function createSmtpTransport(): MailTransport {
  const host = process.env.SMTP_HOST as string;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from =
    process.env.SMTP_FROM ?? "OpusTrack <no-reply@opusinspection.com>";

  const transporter = nodemailer.createTransport({
    host,
    port,
    // Implicit TLS on 465; STARTTLS everywhere else. Mailpit speaks neither,
    // which is why the flag is explicit rather than inferred from the port.
    secure: process.env.SMTP_SECURE === "true",
    ...(user && pass ? { auth: { user, pass } } : {}),
  });

  return {
    name: `smtp(${host}:${port})`,
    async verify() {
      await transporter.verify();
    },
    async send(message) {
      const info = await transporter.sendMail({
        from,
        // Recipients go in BCC so nobody learns who else was notified, and the
        // server receives one message instead of N.
        to: from,
        bcc: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html ?? toHtml(message.text),
      });
      return info?.messageId;
    },
  };
}

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
