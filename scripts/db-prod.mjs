#!/usr/bin/env node
/**
 * Database operations against the PRODUCTION database.
 *
 *   node scripts/db-prod.mjs <status|migrate|seed|reset|studio>
 *
 * The `db:*` commands deliberately refuse to touch anything that is not a local
 * container (scripts/lib/db-guard.ts). This script is the only way past that,
 * and it is intentionally uncomfortable to use:
 *
 *   - it prints the target and the current row counts before doing anything;
 *   - destructive actions require typing the database name to confirm;
 *   - nothing is ever implicit — `seed` and `reset` state exactly what they do.
 *
 * The connection comes from the `prod` profile (.env.production). Note that
 * Vercel reads its variables from the Dashboard, so this file is only as
 * correct as you keep it — check the host printed below before confirming.
 */
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { loadProfile } from "./lib/env-profiles.mjs";

const ACTIONS = {
  status:
    "Muestra el estado de migraciones y el conteo de filas. Solo lectura.",
  migrate: "Aplica las migraciones pendientes (prisma migrate deploy).",
  seed: "Ejecuta el seed. NO borra, pero puede duplicar o sobrescribir datos.",
  reset: "BORRA TODA LA BASE, reaplica migraciones y siembra desde cero.",
  studio: "Abre Prisma Studio conectado a producción (lectura y escritura).",
};

/** Actions that change data and therefore require typed confirmation. */
const DESTRUCTIVE = new Set(["migrate", "seed", "reset", "studio"]);

const action = process.argv[2];

if (!action || !ACTIONS[action]) {
  console.error("Uso: node scripts/db-prod.mjs <acción>\n");
  for (const [name, description] of Object.entries(ACTIONS)) {
    console.error(`  ${name.padEnd(8)} ${description}`);
  }
  process.exit(1);
}

loadProfile("prod");

function target() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error(
      "DATABASE_URL no está definida en .env.production. Nada que hacer.",
    );
    process.exit(1);
  }
  const url = new URL(raw);
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, ""),
    masked: `${url.protocol}//***:***@${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`,
  };
}

function run(command, args, { check = true } = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if (check && result.status !== 0) {
    throw new Error(`Falló: ${command} ${args.join(" ")}`);
  }
  return result.status ?? 1;
}

async function showState({ masked }) {
  console.log(`\n🎯 Base de datos: ${masked}`);
  console.log(`   Acción:        ${action} — ${ACTIONS[action]}\n`);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const counts = {
      usuarios: await prisma.user.count(),
      clientes: await prisma.cliente.count(),
      incidentes: await prisma.incident.count(),
      asignaciones: await prisma.assignment.count(),
      programaciones: await prisma.schedule.count(),
    };
    console.log("   Contenido actual:");
    for (const [name, value] of Object.entries(counts)) {
      console.log(`     ${name.padEnd(15)} ${value}`);
    }
  } catch (error) {
    console.log(`   (no se pudo leer el contenido: ${error.message})`);
  } finally {
    await prisma.$disconnect();
  }
}

async function confirm({ database }) {
  if (action === "reset") {
    console.log(
      "\n⚠️  RESET BORRA TODOS LOS DATOS DE ESTA BASE. No hay deshacer.",
    );
    console.log("   Asegúrate de tener un respaldo antes de continuar.");
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `\nEscribe el nombre de la base ("${database}") para confirmar: `,
  );
  rl.close();

  if (answer.trim() !== database) {
    console.log("\nCancelado. No se hizo ningún cambio.");
    process.exit(1);
  }
}

async function main() {
  const info = target();
  await showState(info);

  if (DESTRUCTIVE.has(action)) {
    await confirm(info);
  }

  switch (action) {
    case "status":
      run("npx", ["prisma", "migrate", "status"], { check: false });
      break;
    case "migrate":
      run("npx", ["prisma", "migrate", "deploy"]);
      break;
    case "seed":
      run("npx", [
        "tsx",
        process.env.PROD_SEED_SCRIPT?.trim() || "initial_load/seed.ts",
      ]);
      break;
    case "reset":
      // --force skips Prisma's own prompt; ours already ran, and --skip-seed
      // keeps the seed an explicit second step.
      run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"]);
      run("npx", [
        "tsx",
        process.env.PROD_SEED_SCRIPT?.trim() || "initial_load/seed.ts",
      ]);
      break;
    case "studio":
      run("npx", ["prisma", "studio"]);
      break;
  }

  console.log("\n✅ Listo.");
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
