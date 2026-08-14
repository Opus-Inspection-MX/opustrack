import { expect } from "@playwright/test";

/**
 * The mailbox the suite asserts against.
 *
 * Mailpit is a real SMTP server running beside the throwaway database
 * (docker-compose.e2e.yml). The app talks to it exactly as it would to a
 * corporate mail server, so these assertions prove delivery rather than
 * proving that a mock was called.
 */

function baseUrl(): string {
  const url = process.env.E2E_MAILPIT_URL;
  if (!url) {
    throw new Error(
      "Falta E2E_MAILPIT_URL. Ejecuta los e2e con `npm run test:e2e`, que carga config/e2e.env.",
    );
  }
  return url.replace(/\/$/, "");
}

interface MailpitMessage {
  ID: string;
  Subject: string;
  To: Array<{ Address: string }>;
  Bcc: Array<{ Address: string }>;
}

/** Empty the mailbox so a test only sees what it caused. */
export async function clearMailbox(): Promise<void> {
  const res = await fetch(`${baseUrl()}/api/v1/messages`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`No se pudo vaciar Mailpit: ${res.status}`);
  }
}

async function listMessages(): Promise<MailpitMessage[]> {
  const res = await fetch(`${baseUrl()}/api/v1/messages?limit=200`);
  if (!res.ok) throw new Error(`Mailpit respondió ${res.status}`);
  const body = (await res.json()) as { messages: MailpitMessage[] };
  return body.messages ?? [];
}

/**
 * Recipients live in BCC — the app sends one message to many people rather than
 * one message each — so a "to" filter has to look at both headers.
 */
function addressees(message: MailpitMessage): string[] {
  return [...(message.To ?? []), ...(message.Bcc ?? [])].map((a) =>
    a.Address.toLowerCase(),
  );
}

/** Messages currently addressed to someone. */
export async function messagesFor(email: string): Promise<MailpitMessage[]> {
  const wanted = email.toLowerCase();
  return (await listMessages()).filter((m) => addressees(m).includes(wanted));
}

/**
 * Wait for a message to arrive.
 *
 * Polled rather than awaited inline: the send happens after the Server Action
 * returns, so the page can settle before the mail server has the message.
 */
export async function waitForMessage(options: {
  to: string;
  subject: RegExp;
  timeout?: number;
}): Promise<MailpitMessage> {
  let found: MailpitMessage | undefined;

  await expect
    .poll(
      async () => {
        const matches = (await messagesFor(options.to)).filter((m) =>
          options.subject.test(m.Subject),
        );
        found = matches[0];
        return matches.length;
      },
      { timeout: options.timeout ?? 15_000 },
    )
    .toBeGreaterThan(0);

  return found as MailpitMessage;
}

/**
 * Assert nobody wrote to this address.
 *
 * Given a moment first: proving absence right after an action would pass simply
 * because the mail had not been delivered yet.
 */
export async function expectNoMessageFor(
  email: string,
  settleMs = 1500,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, settleMs));
  expect(await messagesFor(email)).toHaveLength(0);
}
