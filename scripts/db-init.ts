/**
 * Prepare the local development database: migrate always, seed only when empty.
 *
 * Running `prisma migrate deploy` is idempotent, so it is safe on every start.
 * Seeding is not: re-running it over an existing database would either fail on
 * unique constraints or quietly overwrite work in progress. So the seed runs
 * exactly once — when the database has no users yet — which is what makes
 * `npm run db:init` safe to call on every `docker compose up`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabase, maskDatabaseUrl } from "./lib/db-guard";

/** Real personnel seed (gitignored). Falls back to the tracked template. */
const REAL_SEED = "initial_load/seed.ts";
const TEMPLATE_SEED = "initial_load/seed.example.ts";

function resolveSeedScript(): string {
  const configured = process.env.DEV_SEED_SCRIPT?.trim();
  if (configured) return configured;

  const real = path.resolve(process.cwd(), REAL_SEED);
  return existsSync(real) ? REAL_SEED : TEMPLATE_SEED;
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    throw new Error(`Falló: ${command} ${args.join(" ")}`);
  }
}

async function main(): Promise<void> {
  assertLocalDatabase(process.env.DATABASE_URL);
  console.log(`🎯 Base: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);

  console.log("\n📦 Aplicando migraciones...");
  run("npx", ["prisma", "migrate", "deploy"]);

  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.count();

    if (users > 0) {
      console.log(
        `\n✅ La base ya tiene datos (${users} usuarios). No se vuelve a sembrar.`,
      );
      console.log("   Para empezar de cero: npm run db:reset");
      return;
    }

    const seed = resolveSeedScript();
    console.log(`\n🌱 Base vacía. Sembrando con ${seed}...`);
    run("npx", ["tsx", seed]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`\n${(error as Error).message}\n`);
  process.exit(1);
});
