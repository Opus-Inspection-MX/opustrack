/**
 * Read-only drift check: the permission catalog vs a live database.
 *
 *   tsx scripts/permissions-diff.ts [--sql] [--remote]
 *
 * Compares `src/lib/authz/permission-catalog.ts` (the single source) with the
 * Permission / Role / RolePermission rows in the database and reports:
 *
 * - ERROR: a catalog permission is missing or inactive, or a catalog grant
 *   for a seed role is missing/inactive. Either one is an H-06-shaped hole:
 *   the code requires the permission but the role cannot use it.
 * - INFO: extra active grants on seed roles, extra active permissions, and
 *   roles created from the UI. Those are legitimate — re-seeding never
 *   removes, and the roles screen exists for a reason.
 *
 * Exit code is 1 when any ERROR is reported, 0 otherwise. Nothing here
 * writes: `--sql` only PRINTS an idempotent migration (inicio_home pattern)
 * for a human to review and apply. Never run the output against production
 * without the deploy review in the maintainability plan (Fase 4b).
 *
 * Safety: refuses non-local databases unless `--remote`, which only
 * `scripts/db-prod.mjs permissions` passes (after printing the host).
 */

import { PrismaClient } from "@prisma/client";
import {
  PERMISSION_LIST,
  type PermissionDef,
  resolveSeedGrants,
  SEED_ROLES,
  type SeedRoleCode,
} from "../src/lib/authz/permission-catalog";
import { assertLocalDatabase, maskDatabaseUrl } from "./lib/db-guard";

const args = new Set(process.argv.slice(2));
const EMIT_SQL = args.has("--sql");
const REMOTE = args.has("--remote");

type Drift = {
  missingPermissions: PermissionDef[];
  inactivePermissions: PermissionDef[];
  missingRole: SeedRoleCode[];
  missingGrants: Array<{ role: string; permission: string }>;
  extraGrants: Array<{ role: string; permission: string }>;
  extraPermissions: string[];
  extraRoles: string[];
};

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function sqlLiteral(value: string | null | undefined): string {
  return value == null ? "NULL" : `'${sqlEscape(value)}'`;
}

async function collect(prisma: PrismaClient): Promise<Drift> {
  const [dbPermissions, dbRoles] = await Promise.all([
    prisma.permission.findMany(),
    prisma.role.findMany({
      include: {
        rolePermission: {
          include: { permission: { select: { name: true } } },
        },
      },
    }),
  ]);

  const permByName = new Map(dbPermissions.map((p) => [p.name, p]));
  const drift: Drift = {
    missingPermissions: [],
    inactivePermissions: [],
    missingRole: [],
    missingGrants: [],
    extraGrants: [],
    extraPermissions: [],
    extraRoles: [],
  };

  for (const def of PERMISSION_LIST) {
    const row = permByName.get(def.name);
    if (!row) drift.missingPermissions.push(def);
    else if (!row.active) drift.inactivePermissions.push(def);
  }

  const catalogNames = new Set(PERMISSION_LIST.map((p) => p.name));
  for (const row of dbPermissions) {
    if (row.active && !catalogNames.has(row.name)) {
      drift.extraPermissions.push(row.name);
    }
  }

  const seedCodes = new Set(Object.keys(SEED_ROLES));
  for (const role of dbRoles) {
    if (!seedCodes.has(role.name)) {
      if (role.active) drift.extraRoles.push(role.name);
      continue;
    }
    const code = role.name as SeedRoleCode;
    const activeGrants = new Set(
      role.rolePermission
        .filter((rp) => rp.active)
        .map((rp) => rp.permission.name),
    );
    for (const grant of resolveSeedGrants(code)) {
      if (!activeGrants.has(grant)) {
        drift.missingGrants.push({ role: role.name, permission: grant });
      }
    }
    for (const grant of activeGrants) {
      if (!resolveSeedGrants(code).includes(grant as never)) {
        drift.extraGrants.push({ role: role.name, permission: grant });
      }
    }
  }
  for (const code of seedCodes) {
    if (!dbRoles.some((r) => r.name === code)) {
      drift.missingRole.push(code as SeedRoleCode);
    }
  }
  return drift;
}

function report(drift: Drift): number {
  let errors = 0;
  const error = (message: string) => {
    errors += 1;
    console.log(`ERROR ${message}`);
  };
  const info = (message: string) => console.log(`INFO  ${message}`);

  for (const def of drift.missingPermissions) {
    error(`permission missing in DB: ${def.name}`);
  }
  for (const def of drift.inactivePermissions) {
    error(`permission inactive in DB: ${def.name}`);
  }
  for (const role of drift.missingRole) {
    error(`seed role missing in DB: ${role}`);
  }
  for (const grant of drift.missingGrants) {
    error(`grant missing: role ${grant.role} lacks ${grant.permission}`);
  }
  for (const grant of drift.extraGrants) {
    info(
      `extra grant (legitimate, kept): role ${grant.role} holds ${grant.permission}`,
    );
  }
  for (const name of drift.extraPermissions) {
    info(`extra active permission (legitimate, kept): ${name}`);
  }
  for (const name of drift.extraRoles) {
    info(`UI-created role (legitimate, kept): ${name}`);
  }

  if (errors === 0) console.log("OK: catalog and database agree.");
  else console.log(`${errors} error(s) found.`);
  return errors === 0 ? 0 : 1;
}

/**
 * Idempotent convergence migration in the inicio_home pattern: permission
 * INSERTs resolve by name with ON CONFLICT DO NOTHING (existing rows are
 * never touched), grants go reactivate-then-insert per role so re-runs
 * converge, and ONE sessionVersion bump scoped to users of the touched
 * roles refreshes their JWTs exactly once.
 */
function emitSql(drift: Drift): void {
  const lines: string[] = [
    "-- Fase 4 · permission catalog convergence (generated, review before applying).",
    "--",
    "-- Deploy order: code carrying permission-catalog.ts FIRST, then this",
    "-- migration. It only adds/reactivates rows the catalog defines, so",
    "-- either order is safe, but the code must know the names it requires.",
    "--",
    "-- Idempotency: permission INSERTs resolve by name with ON CONFLICT DO",
    "-- NOTHING; grant reactivations run as UPDATE first, so a half-applied",
    "-- run converges instead of sticking. Safe to re-run.",
    "--",
    "-- Verification after applying:",
    '--   SELECT p."name" FROM "public"."Permission" p WHERE p."active" = FALSE;',
    "-- must return zero rows for catalog names; re-run this diff with no",
    "-- --sql and expect `OK: catalog and database agree.`.",
    "",
  ];

  if (drift.missingPermissions.length > 0) {
    lines.push(
      "-- ============================================================================",
      "-- 1. Missing permissions (by name — re-runs change nothing)",
      "-- ============================================================================",
      'INSERT INTO "public"."Permission"',
      '  ("name", "description", "resource", "action", "routePath", "exact", "active")',
      "VALUES",
    );
    const values = drift.missingPermissions
      .map(
        (def) =>
          `  ('${sqlEscape(def.name)}', '${sqlEscape(def.description)}', ` +
          `${sqlLiteral(def.resource)}, ${sqlLiteral(def.action)}, ` +
          `${sqlLiteral(def.routePath)}, ${def.exact ? "TRUE" : "FALSE"}, TRUE)`,
      )
      .join(",\n");
    lines.push(`${values}\nON CONFLICT ("name") DO NOTHING;\n`);
  }

  const grantsByRole = new Map<string, string[]>();
  for (const grant of drift.missingGrants) {
    const list = grantsByRole.get(grant.role) ?? [];
    list.push(grant.permission);
    grantsByRole.set(grant.role, list);
  }
  if (grantsByRole.size > 0) {
    lines.push(
      "-- ============================================================================",
      "-- 2. Missing grants: reactivate-then-insert so re-runs converge",
      "-- ============================================================================",
    );
    for (const [role, perms] of grantsByRole) {
      const list = perms.map((p) => `'${sqlEscape(p)}'`).join(", ");
      lines.push(
        `-- 2x. ${role}: ${perms.join(", ")}`,
        'UPDATE "public"."RolePermission" rp',
        'SET "active" = TRUE',
        'FROM "public"."Role" r, "public"."Permission" p',
        'WHERE rp."roleId" = r."id"',
        '  AND rp."permissionId" = p."id"',
        `  AND r."name" = '${sqlEscape(role)}'`,
        `  AND p."name" IN (${list});`,
        "",
        'INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "active")',
        'SELECT r."id", p."id", TRUE',
        'FROM "public"."Role" r',
        'CROSS JOIN "public"."Permission" p',
        `WHERE r."name" = '${sqlEscape(role)}'`,
        `  AND p."name" IN (${list})`,
        'ON CONFLICT ("roleId", "permissionId") DO NOTHING;',
        "",
      );
    }
    const roles = [...grantsByRole.keys()]
      .map((r) => `'${sqlEscape(r)}'`)
      .join(", ");
    lines.push(
      "-- ============================================================================",
      "-- 3. ONE sessionVersion bump for users of the touched roles",
      "-- ============================================================================",
      'UPDATE "public"."User"',
      'SET "sessionVersion" = "sessionVersion" + 1',
      'WHERE "active" = TRUE',
      '  AND "id" IN (',
      '    SELECT ur."userId"',
      '    FROM "public"."user_roles" ur',
      '    JOIN "public"."Role" r ON r."id" = ur."roleId"',
      `    WHERE r."name" IN (${roles})`,
      "  );",
    );
  }

  if (drift.missingPermissions.length === 0 && grantsByRole.size === 0) {
    lines.push("-- Catalog and database agree: nothing to emit.");
  }
  console.log(lines.join("\n"));
}

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!REMOTE) assertLocalDatabase(url);
  console.log(
    `Target: ${maskDatabaseUrl(url)}${REMOTE ? " (remote, read-only)" : ""}\n`,
  );

  const prisma = new PrismaClient();
  try {
    const drift = await collect(prisma);
    if (EMIT_SQL) {
      emitSql(drift);
      return 0;
    }
    return report(drift);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : error}\n`);
    process.exit(2);
  });
