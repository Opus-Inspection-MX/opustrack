#!/usr/bin/env node
/**
 * Ephemeral drift proof for the Prisma migrations directory.
 *
 * Every run performs two `prisma migrate diff` checks against a shadow
 * database that is created for this run and always dropped afterwards:
 *
 *   1. green    — migrations as committed vs the schema: expect exit 0
 *                 (empty diff, no drift).
 *   2. negative — the same migrations with ONE `ALTER INDEX` line removed
 *                 from a throwaway copy: expect exit 2 (non-empty diff),
 *                 proving the check can actually catch drift.
 *
 * Safety: refuses to run unless BOTH `DATABASE_URL` and
 * `SHADOW_DATABASE_URL` point at localhost/127.0.0.1 (fail closed,
 * non-zero, no side effects). The shadow database is dropped
 * `WITH (FORCE)` in a `finally`, so a passing or failing run never leaves
 * anything behind. Never point this at production.
 *
 * Usage:
 *   node scripts/with-env.mjs <dev|e2e> -- node scripts/drift-proof.mjs \
 *     --compose-file <docker-compose.yml>
 *
 * Stdlib only — no new dependencies.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
// Migration whose copy the negative test mutates (one ALTER INDEX removed).
const NEGATIVE_MIGRATION_DIR = "20260910173827_rename_cliente_to_client";
// `docker compose ps -q <service>` candidates, in order. The dev stack names
// its database service `db`; the e2e stack names it `e2e-db`.
const DB_SERVICES = ["db", "e2e-db"];

function usage() {
  return [
    "Usage: node scripts/drift-proof.mjs --compose-file <file>",
    "",
    "Runs the ephemeral drift proof: creates a shadow database inside the",
    "compose database container, diffs migrations vs schema (expect: no",
    "diff), diffs a sabotaged migrations copy vs schema (expect: diff), then",
    "always drops the shadow database and removes the copy.",
    "",
    "Options:",
    "  --compose-file <file>  Compose file whose database service hosts the",
    "                         shadow database (required).",
    "  --green-only           Run only the green check (migrations vs schema,",
    "                         expect exit 0) and skip the sabotage-copy",
    "                         negative leg. Still creates the shadow database",
    "                         and always drops it in a finally.",
    "  --help                 Print this help and exit (no side effects).",
    "",
    "Environment (via scripts/with-env.mjs <profile>):",
    "  DATABASE_URL           Must use host localhost/127.0.0.1.",
    "  SHADOW_DATABASE_URL    Must use host localhost/127.0.0.1. Its database",
    "                         is dropped WITH (FORCE) before and after the run.",
    "                         Optional: when unset, defaults to the DATABASE_URL",
    "                         server with a '<db>_shadow' database.",
    "",
    "Exit codes: 0 = PASS (green 0 and negative 2; green 0 with --green-only),",
    "             1 = any failure.",
  ].join("\n");
}

function fail(message) {
  console.error(`drift-proof: ${message}`);
  process.exit(1);
}

function hostnameOf(rawUrl, name) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail(`${name} is not a valid URL.`);
  }
  return parsed.hostname.replace(/^\[|\]$/g, "");
}

/** Run a command, inheriting stdio so the proof transcript stays visible. */
function runVisible(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  return result.status ?? 1;
}

/** Run a command quietly; returns { status, stdout, stderr }. */
function runQuiet(command, args) {
  const result = spawnSync(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    process.exit(0);
  }

  let composeFile = null;
  let greenOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--compose-file") {
      composeFile = argv[i + 1] ?? null;
      i += 1;
    } else if (argv[i] === "--green-only") {
      greenOnly = true;
    } else {
      fail(`unknown argument "${argv[i]}".\n${usage()}`);
    }
  }
  if (!composeFile) fail(`missing required --compose-file.\n${usage()}`);

  const databaseUrl = process.env.DATABASE_URL;
  let shadowUrl = process.env.SHADOW_DATABASE_URL;
  if (!databaseUrl?.trim()) fail("DATABASE_URL is not set.");
  if (!shadowUrl?.trim()) {
    // Zero-config default: same server as DATABASE_URL, "<db>_shadow"
    // database. An explicitly set SHADOW_DATABASE_URL always wins. The
    // derived value goes through the same localhost guard below.
    let derived;
    try {
      derived = new URL(databaseUrl);
    } catch {
      fail("DATABASE_URL is not a valid URL, cannot derive a shadow database.");
    }
    const base = decodeURIComponent(derived.pathname.replace(/^\//, ""));
    if (!base) {
      fail(
        "DATABASE_URL has no database name, cannot derive a shadow database.",
      );
    }
    derived.pathname = `/${encodeURIComponent(`${base}_shadow`)}`;
    shadowUrl = derived.toString();
  }

  // Fail closed BEFORE any side effect: both hosts must be local.
  for (const [name, value] of [
    ["DATABASE_URL", databaseUrl],
    ["SHADOW_DATABASE_URL", shadowUrl],
  ]) {
    const host = hostnameOf(value, name);
    if (!LOCAL_HOSTS.has(host)) {
      fail(
        `${name} host "${host}" is not localhost/127.0.0.1 — refusing to touch it.`,
      );
    }
  }

  const shadow = new URL(shadowUrl);
  const shadowDb = decodeURIComponent(shadow.pathname.replace(/^\//, ""));
  const shadowUser = decodeURIComponent(shadow.username);
  if (!shadowDb) fail("SHADOW_DATABASE_URL has no database name.");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(shadowDb)) {
    fail(`shadow database name "${shadowDb}" is not a safe SQL identifier.`);
  }
  if (!shadowUser) fail("SHADOW_DATABASE_URL has no username.");
  const quotedDb = `"${shadowDb}"`;

  // Resolve the database container id at runtime (profile-agnostic).
  let containerId = "";
  for (const service of DB_SERVICES) {
    const ps = runQuiet("docker", [
      "compose",
      "-f",
      composeFile,
      "ps",
      "-q",
      service,
    ]);
    if (ps.status === 0 && ps.stdout.trim()) {
      containerId = ps.stdout.trim().split("\n")[0].trim();
      break;
    }
  }
  if (!containerId) {
    fail(
      `could not resolve a database container (tried services ${DB_SERVICES.join(", ")}) — is the stack up?`,
    );
  }

  const psql = (sql) =>
    runQuiet("docker", [
      "exec",
      containerId,
      "psql",
      "-U",
      shadowUser,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ]);

  const dropShadow = () =>
    psql(`DROP DATABASE IF EXISTS ${quotedDb} WITH (FORCE)`);

  // Ephemeral from the start: a leftover shadow from a crashed run is
  // dropped (forced — backends may still hold it) and recreated.
  const create = psql(`CREATE DATABASE ${quotedDb}`);
  if (create.status !== 0) {
    if (/already exists/i.test(`${create.stdout}\n${create.stderr}`)) {
      const drop = dropShadow();
      if (drop.status !== 0) {
        fail(
          `shadow database already exists and DROP failed: ${drop.stderr.trim()}`,
        );
      }
      const retry = psql(`CREATE DATABASE ${quotedDb}`);
      if (retry.status !== 0) {
        fail(`CREATE DATABASE after DROP failed: ${retry.stderr.trim()}`);
      }
    } else {
      fail(`CREATE DATABASE failed: ${create.stderr.trim()}`);
    }
  }

  const cleanupWarnings = [];
  let green = null;
  let negative = null;
  try {
    const diffArgs = (migrationsDir) => [
      "prisma",
      "migrate",
      "diff",
      "--from-migrations",
      migrationsDir,
      "--to-schema-datamodel",
      "./prisma/schema.prisma",
      "--shadow-database-url",
      shadowUrl,
      "--exit-code",
    ];

    console.log("\n=== drift-proof: green check (expect exit 0) ===");
    green = runVisible("npx", diffArgs("./prisma/migrations"));

    // Negative control: sabotage a throwaway copy, never the real directory.
    // Skipped entirely with --green-only.
    if (!greenOnly) {
      const scratch = mkdtempSync(path.join(tmpdir(), "drift-proof-"));
      try {
        cpSync("./prisma/migrations", path.join(scratch, "migrations"), {
          recursive: true,
        });
        const target = path.join(
          scratch,
          "migrations",
          NEGATIVE_MIGRATION_DIR,
          "migration.sql",
        );
        const lines = readFileSync(target, "utf8").split("\n");
        const victim = lines.findIndex((line) =>
          /^\s*ALTER\s+INDEX\s/i.test(line),
        );
        if (victim === -1) {
          fail(
            `negative setup: no ALTER INDEX line found in ${NEGATIVE_MIGRATION_DIR}.`,
          );
        }
        lines.splice(victim, 1);
        writeFileSync(target, lines.join("\n"));

        console.log("\n=== drift-proof: negative check (expect exit 2) ===");
        negative = runVisible(
          "npx",
          diffArgs(path.join(scratch, "migrations")),
        );
      } finally {
        try {
          rmSync(scratch, { recursive: true, force: true });
        } catch (error) {
          cleanupWarnings.push(
            `could not remove scratch dir: ${error.message}`,
          );
        }
      }
    }
  } finally {
    // Always drop the shadow database; cleanup failures are reported but
    // never mask the verdict.
    try {
      const drop = dropShadow();
      if (drop.status !== 0) {
        cleanupWarnings.push(`DROP DATABASE failed: ${drop.stderr.trim()}`);
      }
    } catch (error) {
      cleanupWarnings.push(`DROP DATABASE threw: ${error.message}`);
    }
  }

  for (const warning of cleanupWarnings) {
    console.error(`drift-proof cleanup warning: ${warning}`);
  }

  console.log(
    greenOnly
      ? `\ndrift-proof: green=${green} (want 0, green-only)`
      : `\ndrift-proof: green=${green} (want 0), negative=${negative} (want 2)`,
  );
  if (greenOnly) {
    if (green === 0) {
      console.log(
        "drift-proof: PASS (green-only) — schema matches migrations.",
      );
      process.exit(0);
    }
    fail(`green check exited ${green}, want 0 (drift detected).`);
  }
  if (green === 0 && negative === 2) {
    console.log(
      "drift-proof: PASS — schema matches migrations, and the check detects drift.",
    );
    process.exit(0);
  }
  if (green !== 0)
    fail(`green check exited ${green}, want 0 (drift detected).`);
  fail(`negative check exited ${negative}, want 2 (check is blind to drift).`);
}

main();
