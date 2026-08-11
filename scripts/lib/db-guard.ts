/**
 * Guards that keep destructive database commands on a local container.
 *
 * This project's production database is hosted (Neon), and `.env.development`
 * used to point at it — which meant `npm run db:reset` was one typo away from
 * wiping the cloud. Every command that migrates, seeds or resets now asserts
 * where it is pointing first.
 *
 * Dependency-free on purpose: imported by plain node scripts, by the Playwright
 * config and by its setup project, so it cannot rely on any runtime.
 */

/** Hosts that can only ever be a local database. `db` is the compose service. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db"]);

/** `new URL` keeps IPv6 hosts bracketed (`[::1]`); compare without them. */
function hostnameOf(parsed: URL): string {
  return parsed.hostname.replace(/^\[|\]$/g, "");
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

/** Parse a connection string, or throw a message naming what was received. */
export function parseDatabaseUrl(url: string | undefined): URL {
  if (!url?.trim()) {
    throw new Error(
      "DATABASE_URL no está definida. Revisa el archivo de entorno del perfil que estás usando.",
    );
  }
  try {
    return new URL(url);
  } catch {
    throw new Error(
      `DATABASE_URL no es una URL válida: ${maskDatabaseUrl(url)}`,
    );
  }
}

/** True when the connection string points at a host that is necessarily local. */
export function isLocalDatabase(url: string | undefined): boolean {
  try {
    return LOCAL_HOSTS.has(hostnameOf(parseDatabaseUrl(url)));
  } catch {
    return false;
  }
}

/**
 * Throw unless `url` points at a local database.
 *
 * Used by the development commands (migrate / seed / reset). Deliberately
 * looser than the e2e guard: development runs against a persistent container
 * whose name and port the developer may change.
 */
export function assertLocalDatabase(url: string | undefined): void {
  const parsed = parseDatabaseUrl(url);

  if (!LOCAL_HOSTS.has(hostnameOf(parsed))) {
    throw new Error(
      [
        "Este comando solo puede correr contra una base de datos local.",
        `  recibido: ${maskDatabaseUrl(url)}`,
        `  esperado: un host local (${[...LOCAL_HOSTS].join(", ")})`,
        "",
        "Levanta la base local con `npm run db:up`. La base de producción",
        "(Neon) se administra desde Vercel, nunca desde estos scripts.",
      ].join("\n"),
    );
  }
}
