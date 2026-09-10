/**
 * Prueba el envío de correo con las credenciales de desarrollo.
 *
 * Uso:
 *   node scripts/with-env.mjs dev -- tsx scripts/mail-test.ts destino@ejemplo.com
 *   npm run mail:test -- destino@ejemplo.com
 *
 * Lee SMTP_HOST/PORT/USER/PASS/FROM del perfil dev (`.env.development` más
 * `.env.development.local`, que está en gitignore). Usa el transporte real de
 * la app (`getMailTransport`) y llama a `.send()` directo para que los fallos
 * salgan con exit code — `sendMail()` nunca lanza, así que no sirve para
 * probar. Nunca imprime secretos.
 */

import { getMailTransport } from "../src/lib/mail/index";

async function main(): Promise<void> {
  const to = process.argv[2] ?? process.env.SMTP_TEST_TO;

  if (!to) {
    console.error(
      "Falta el destinatario.\nUso: npm run mail:test -- destino@ejemplo.com",
    );
    process.exit(2);
  }

  const transport = getMailTransport();
  const host = process.env.SMTP_HOST ?? "(sin SMTP_HOST)";
  const port = process.env.SMTP_PORT ?? "587";
  console.log(`Transporte: ${transport.name}`);

  if (transport.name === "noop") {
    console.error(
      `Sin SMTP_HOST no hay nada que probar (transporte noop). ` +
        `Configura SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM en ` +
        `.env.development.local (gitignored) y vuelve a intentar. ` +
        `Host visto: ${host}:${port}.`,
    );
    process.exit(2);
  }

  try {
    await transport.send({
      to: [to],
      subject: "[OpusTrack] Correo de prueba",
      text: `Este es un correo de prueba de OpusTrack.\nSi lo estás leyendo, el transporte SMTP (${host}:${port}) funciona.`,
    });
    console.log(
      `OK: correo de prueba aceptado por ${host}:${port} para ${to}.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FALLO enviando a ${to} vía ${host}:${port}: ${message}`);
    process.exit(1);
  }
}

void main();
