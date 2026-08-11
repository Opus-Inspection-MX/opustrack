import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * Environment profiles. One place defines what each one means, so no npm
 * script has to spell out a chain of dotenv flags.
 */

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** Profile → env files, in increasing order of precedence. */
export const PROFILES = {
  /** Local development: database and app in Docker, filesystem storage. */
  dev: [".env.development", ".env.development.local"],
  /** Local production build against Neon. Vercel does NOT use these files. */
  prod: [".env.production", ".env.production.local"],
  /** End-to-end suite: database created and destroyed per run. */
  e2e: ["config/e2e.env", "config/e2e.local.env"],
};

/**
 * Load a profile into `process.env`.
 *
 * `override: true` is deliberate: it stops a variable already exported in the
 * shell — DATABASE_URL above all — from silently redirecting a command at the
 * wrong database. A missing optional file is ignored.
 */
export function loadProfile(profile) {
  const files = PROFILES[profile];
  if (!files) {
    throw new Error(
      `Perfil desconocido: "${profile}". Opciones: ${Object.keys(PROFILES).join(", ")}`,
    );
  }
  for (const file of files) {
    dotenv.config({ path: path.join(ROOT, file), override: true, quiet: true });
  }
}
