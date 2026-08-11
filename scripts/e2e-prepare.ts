/**
 * Prepare the ephemeral e2e database: migrate and seed it, every run.
 *
 * Unlike the development database this one is thrown away on
 * `npm run e2e:down`, so seeding is unconditional — the suite must start from a
 * known catalog of roles, statuses and clientes.
 */
import { spawnSync } from "node:child_process";
import { assertEphemeralDatabase } from "../e2e/fixtures/ephemeral-db";
import { maskDatabaseUrl } from "./lib/db-guard";

const TEMPLATE_SEED = "initial_load/seed.example.ts";

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    throw new Error(`Falló: ${command} ${args.join(" ")}`);
  }
}

function main(): void {
  assertEphemeralDatabase(process.env.DATABASE_URL);
  console.log(`🎯 Base e2e: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);

  run("npx", ["prisma", "migrate", "deploy"]);
  run("npx", ["tsx", process.env.E2E_SEED_SCRIPT?.trim() || TEMPLATE_SEED]);
}

try {
  main();
} catch (error) {
  console.error(`\n${(error as Error).message}\n`);
  process.exit(1);
}
