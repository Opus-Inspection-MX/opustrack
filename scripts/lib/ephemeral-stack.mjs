#!/usr/bin/env node
/**
 * Shared lifecycle for suites that run against a throwaway Postgres.
 *
 * Both `scripts/e2e.mjs` (full stack: database + app + browser) and
 * `scripts/test-int.mjs` (database only + vitest) follow the same cycle:
 *
 *   1. down -v   — discard anything a previous run left behind
 *   2. up -d --wait [service] — a brand-new, empty database
 *   3. prepare   — migrate + seed (scripts/e2e-prepare.ts)
 *   4. run the suite (caller-provided)
 *   5. down -v   — always, in a finally AND on signals
 *
 * The teardown has to run **whatever happens** — tests failing, a crash,
 * Ctrl-C. `&&` short-circuits on failure and would leave the container
 * alive, which is how test data survived between runs before (15 incidents
 * had piled up) and, worse, how a suite pointed at the wrong database once
 * left four accounts behind in a real one.
 *
 * NOTE: `test:int` and `test:e2e` share the same compose project, container
 * name and port (5433). They MUST NOT run simultaneously on one machine —
 * the second `up` either fails or hijacks the first run's database.
 */
import { spawnSync } from "node:child_process";

export const COMPOSE_FILE = "docker-compose.e2e.yml";

export function composeArgs(extra = []) {
  return ["compose", "-f", COMPOSE_FILE, ...extra];
}

export function run(
  command,
  commandArgs,
  { quiet = false, check = true } = {},
) {
  const result = spawnSync(command, commandArgs, {
    stdio: quiet ? "ignore" : "inherit",
    shell: false,
    env: process.env,
  });
  if (check && result.status !== 0) {
    throw new Error(`Falló: ${command} ${commandArgs.join(" ")}`);
  }
  return result.status ?? 1;
}

/** Remove the container and its volumes. Never throws — it is the cleanup. */
export function teardown({ quiet = true } = {}) {
  run("docker", composeArgs(["down", "-v"]), { quiet, check: false });
}

/**
 * Guarded cleanup: call once, then run the suite inside try/finally calling
 * the returned `cleanup`. Ctrl-C and SIGTERM also tear down — a leaked
 * ephemeral database is a test-isolation bug waiting to happen.
 */
export function installCleanup(label = "la base efímera") {
  let tornDown = false;

  function cleanup({ quiet = false } = {}) {
    if (tornDown) return;
    tornDown = true;
    console.log(`\n🧹 Destruyendo ${label}...`);
    teardown({ quiet });
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      cleanup();
      process.exit(130);
    });
  }

  return cleanup;
}

/** Start from nothing, then bring up a brand-new database (optionally one service). */
export function bringUpDatabase(services = []) {
  // A previous crash may have left one running; start from nothing.
  teardown();
  console.log("🐳 Creando la base efímera...");
  run("docker", composeArgs(["up", "-d", "--wait", ...services]));
}

/** Migrate + seed the ephemeral database. Every run starts from the seed. */
export function prepareDatabase() {
  console.log("\n📦 Migrando y sembrando...");
  run("npx", ["tsx", "scripts/e2e-prepare.ts"]);
}
