#!/usr/bin/env node
/**
 * Run the integration suite against a real, ephemeral Postgres.
 *
 *   node scripts/test-int.mjs [argumentos de vitest...]
 *
 * Same lifecycle as `scripts/e2e.mjs` (see scripts/lib/ephemeral-stack.mjs),
 * but lighter: only the database container comes up (`e2e-db`), no app
 * build, no browser. Vitest runs with `--project integration` — the unit
 * project is untouched, and its 75% coverage bar does not apply here.
 *
 *   1. down -v            — discard anything a previous run left behind
 *   2. up -d --wait e2e-db — database only (faster than the full e2e stack)
 *   3. prepare            — migrate + seed
 *   4. vitest run --project integration
 *   5. down -v            — always, in a finally and on signals
 *
 * NOTE: `test:int` and `test:e2e` share the same compose project, container
 * name and port (5433). They MUST NOT run simultaneously on one machine —
 * run one, wait for its teardown, then the other.
 */
import { loadProfile } from "./lib/env-profiles.mjs";
import {
  bringUpDatabase,
  installCleanup,
  prepareDatabase,
  run,
} from "./lib/ephemeral-stack.mjs";

const vitestArgs = process.argv.slice(2);

loadProfile("e2e");

const cleanup = installCleanup();

let exitCode = 1;

try {
  bringUpDatabase(["e2e-db"]);
  prepareDatabase();

  console.log("\n🧪 Ejecutando integración (Postgres real)...\n");
  exitCode = run(
    "npx",
    ["vitest", "run", "--project", "integration", ...vitestArgs],
    { check: false },
  );
} catch (error) {
  console.error(`\n${error.message}\n`);
  exitCode = 1;
} finally {
  cleanup();
}

process.exit(exitCode);
