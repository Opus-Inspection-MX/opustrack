import {
  isLocalDatabase,
  maskDatabaseUrl,
  parseDatabaseUrl,
} from "../../scripts/lib/db-guard";

/**
 * The e2e suite is only ever allowed to talk to the throwaway container defined
 * in docker-compose.e2e.yml.
 *
 * Stricter than `assertLocalDatabase`: development runs against a persistent
 * local database whose port and name the developer may change, but the e2e
 * database is created and destroyed by the suite, so its identity is fixed and
 * can be pinned exactly. Getting this wrong once means writing test data into
 * the development database.
 */

export { maskDatabaseUrl };

/** Database name created by docker-compose.e2e.yml. */
export const EPHEMERAL_DB_NAME = "opustrack_e2e";

/** Port the container publishes; mirrors E2E_DB_PORT in config/e2e.env. */
function expectedPort(): string {
  return process.env.E2E_DB_PORT?.trim() || "5433";
}

/**
 * Throw unless `url` is the ephemeral e2e database.
 *
 * All three must hold: a local host, the expected port, and the expected
 * database name. Any one of them alone is too easy to hit by accident.
 */
export function assertEphemeralDatabase(url: string | undefined): void {
  const parsed = parseDatabaseUrl(url);
  const database = parsed.pathname.replace(/^\//, "");
  const port = parsed.port || "5432";

  const isEphemeral =
    isLocalDatabase(url) &&
    port === expectedPort() &&
    database === EPHEMERAL_DB_NAME;

  if (!isEphemeral) {
    throw new Error(
      [
        "Los e2e solo pueden correr contra la base efímera de Docker.",
        `  recibido: ${maskDatabaseUrl(url)}`,
        `  esperado: localhost:${expectedPort()}/${EPHEMERAL_DB_NAME}`,
        "",
        "Esa URL no es la base efímera. Levántala con `npm run e2e:up` y",
        "ejecuta la suite con `npm run test:e2e`, que carga config/e2e.env.",
      ].join("\n"),
    );
  }
}
