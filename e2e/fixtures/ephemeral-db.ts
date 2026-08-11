/**
 * The e2e suite is only ever allowed to talk to the throwaway container defined
 * in docker-compose.e2e.yml.
 *
 * This is enforced rather than assumed: `.env.development` in this project
 * points at a hosted Neon database, so a suite that silently inherited the
 * shell environment would run — and write — against the cloud.
 *
 * Dependency-free on purpose: imported by playwright.config.ts, by the setup
 * project, and by a plain node script, so it cannot rely on any runtime.
 */

/** Database name created by docker-compose.e2e.yml. */
export const EPHEMERAL_DB_NAME = "opustrack_e2e";

/** Hosts that can only ever be the local container. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Port the container publishes; mirrors E2E_DB_PORT in config/e2e.env. */
function expectedPort(): string {
  return process.env.E2E_DB_PORT?.trim() || "5433";
}

/** Render a connection string without its credentials, for error messages. */
export function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return "<vacía>";
  try {
    const parsed = new URL(url);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//***:***@${parsed.hostname}${port}${parsed.pathname}`;
  } catch {
    return "<inválida>";
  }
}

/**
 * Throw unless `url` is the ephemeral e2e database.
 *
 * All three must hold: a local host, the expected port, and the expected
 * database name. Any one of them alone is too easy to hit by accident.
 */
export function assertEphemeralDatabase(url: string | undefined): void {
  if (!url?.trim()) {
    throw new Error(
      "DATABASE_URL no está definida para los e2e. Ejecuta `npm run test:e2e`, " +
        "que carga config/e2e.env.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `DATABASE_URL no es una URL válida: ${maskDatabaseUrl(url)}`,
    );
  }

  const database = parsed.pathname.replace(/^\//, "");
  const port = parsed.port || "5432";

  const isEphemeral =
    LOCAL_HOSTS.has(parsed.hostname) &&
    port === expectedPort() &&
    database === EPHEMERAL_DB_NAME;

  if (!isEphemeral) {
    throw new Error(
      [
        "Los e2e solo pueden correr contra la base efímera de Docker.",
        `  recibido: ${maskDatabaseUrl(url)}`,
        `  esperado: localhost:${expectedPort()}/${EPHEMERAL_DB_NAME}`,
        "",
        "Esa URL no es la base efímera. Levántala con `npm run e2e:db:up` y",
        "ejecuta la suite con `npm run test:e2e`, que carga config/e2e.env.",
      ].join("\n"),
    );
  }
}
