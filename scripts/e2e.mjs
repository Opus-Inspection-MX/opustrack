#!/usr/bin/env node
/**
 * Run the end-to-end suite against a database that is created for this run and
 * destroyed when it ends.
 *
 *   node scripts/e2e.mjs [--dev] [argumentos de playwright...]
 *
 * Why an orchestrator instead of chained npm scripts: the teardown has to run
 * **whatever happens** — tests failing, a crash, Ctrl-C. `&&` short-circuits on
 * failure and would leave the container alive, which is how test data survived
 * between runs before (15 incidents had piled up) and, worse, how a suite
 * pointed at the wrong database once left four accounts behind in a real one.
 *
 * Sequence:
 *   1. down -v   — discard anything a previous run left behind
 *   2. up --wait — a brand-new, empty database
 *   3. prepare   — migrate + seed
 *   4. build     — production server (skipped with --dev)
 *   5. playwright
 *   6. down -v   — always, in a finally
 *
 * NOTE: `test:int` and `test:e2e` share the same compose project, container
 * name and port — they MUST NOT run simultaneously on one machine.
 */
import { rmSync } from "node:fs";
import { loadProfile } from "./lib/env-profiles.mjs";
import {
  bringUpDatabase,
  installCleanup,
  prepareDatabase,
  run,
} from "./lib/ephemeral-stack.mjs";

const args = process.argv.slice(2);
const devMode = args.includes("--dev");
const playwrightArgs = args.filter((a) => a !== "--dev");

loadProfile("e2e");
if (devMode) process.env.E2E_SERVER = "dev";

const cleanup = installCleanup();

let exitCode = 1;

try {
  bringUpDatabase();
  prepareDatabase();

  if (!devMode) {
    console.log("\n🏗️  Compilando la app...");
    // Always cold: reusing .next/cache/webpack between builds occasionally
    // corrupts the incremental cache and crashes the build worker with
    // "TypeError: Cannot read properties of null (reading 'hash')" deep in
    // webpack's internals. A stale .next from a previous run/build/dev
    // session on the host is what triggers it — wipe it first every time.
    rmSync(".next", { recursive: true, force: true });
    run("npx", ["next", "build"]);
  }

  console.log("\n🎭 Ejecutando Playwright...\n");
  exitCode = run("npx", ["playwright", "test", ...playwrightArgs], {
    check: false,
  });
} catch (error) {
  console.error(`\n${error.message}\n`);
  exitCode = 1;
} finally {
  cleanup();
}

process.exit(exitCode);
