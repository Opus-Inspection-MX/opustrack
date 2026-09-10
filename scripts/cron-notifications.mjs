#!/usr/bin/env node
/**
 * Trigger the notifications cron locally.
 *
 * Usage:
 *   npm run cron:notifications
 *
 * Calls GET /api/cron/notifications with the dev profile's CRON_SECRET (same
 * bearer scheme Vercel Cron uses in production). The app must be running
 * (`npm run dev:host` or the Docker stack). Prints the HTTP status plus the
 * JSON count summary and exits non-zero when the run fails. Never prints the
 * secret.
 */

const base = process.env.CRON_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error(
    "Falta CRON_SECRET. Agrégalo a .env.development o .env.development.local (gitignored):\n" +
      '  CRON_SECRET="$(openssl rand -hex 32)"\n' +
      "y vuelve a correr: npm run cron:notifications",
  );
  process.exit(2);
}

const response = await fetch(`${base}/api/cron/notifications`, {
  headers: { authorization: `Bearer ${secret}` },
});
const body = await response.text();
console.log(`HTTP ${response.status}\n${body}`);
process.exit(response.ok ? 0 : 1);
