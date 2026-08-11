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
 */
import { spawnSync } from "node:child_process";
import { loadProfile } from "./lib/env-profiles.mjs";

const COMPOSE = ["compose", "-f", "docker-compose.e2e.yml"];

const args = process.argv.slice(2);
const devMode = args.includes("--dev");
const playwrightArgs = args.filter((a) => a !== "--dev");

loadProfile("e2e");
if (devMode) process.env.E2E_SERVER = "dev";

function run(command, commandArgs, { quiet = false, check = true } = {}) {
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
function teardown({ quiet = true } = {}) {
  run("docker", [...COMPOSE, "down", "-v"], { quiet, check: false });
}

let exitCode = 1;
let tornDown = false;

function cleanup() {
  if (tornDown) return;
  tornDown = true;
  console.log("\n🧹 Destruyendo la base efímera...");
  teardown({ quiet: false });
}

// Ctrl-C and terminations must not leak the container either.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanup();
    process.exit(130);
  });
}

try {
  // A previous crash may have left one running; start from nothing.
  teardown();

  console.log("🐳 Creando la base efímera...");
  run("docker", [...COMPOSE, "up", "-d", "--wait"]);

  console.log("\n📦 Migrando y sembrando...");
  run("npx", ["tsx", "scripts/e2e-prepare.ts"]);

  if (!devMode) {
    console.log("\n🏗️  Compilando la app...");
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
