import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fase 0d (H-06): grants faltantes y botones que no se pueden usar.
 *
 * Static source scans, in the style of `actions-contract.test.ts`: the defect
 * class here (a permission no role holds, a button no role may use, a dead
 * exported action) compiles, passes `tsc`/`biome`, and is invisible to tests
 * that mock Prisma — so the source itself is the assertion surface.
 */

const ROOT = process.cwd();
const ACTIONS_DIR = join(ROOT, "src/lib/actions");
const SEED_TEMPLATE = join(ROOT, "initial_load/seed.example.ts");
const INCIDENT_DETAIL_PAGE = join(
  ROOT,
  "src/app/admin/incidents/[id]/page.tsx",
);
const ASSIGNMENT_DETAIL_PAGE = join(
  ROOT,
  "src/app/admin/assignments/[id]/page.tsx",
);
const ACCRUAL_RULES = join(ROOT, "src/lib/actions/vacation-accrual-rules.ts");
const ACCRUAL_PAGE = join(
  ROOT,
  "src/app/admin/settings/vacation-accrual/page.tsx",
);

function roleBlock(source: string, role: string, nextRole: string): string {
  const start = source.indexOf(`name: "${role}"`);
  const end = source.indexOf(`name: "${nextRole}"`);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Role block not found for ${role}`);
  }
  return source.slice(start, end);
}

function migrationSources(): Array<{ file: string; sql: string }> {
  const dir = join(ROOT, "prisma/migrations");
  return readdirSync(dir)
    .filter((entry) => entry !== "migration_lock.toml")
    .map((entry) => {
      const file = join(dir, entry, "migration.sql");
      try {
        return { file, sql: readFileSync(file, "utf8") };
      } catch {
        return null;
      }
    })
    .filter((m): m is { file: string; sql: string } => m !== null);
}

function tsSources(dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".test.tsx")
      ) {
        out.push(full);
      }
    }
  };
  for (const dir of dirs) walk(dir);
  return out;
}

describe("Fase 0d: missing grants and unusable buttons (H-06)", () => {
  describe("role-permission mapping (seed template + data migration)", () => {
    it("ADMIN_OPERACION holds incidents:cancel, states:read and assignments:reopen", () => {
      const seed = readFileSync(SEED_TEMPLATE, "utf8");
      const block = roleBlock(seed, "ADMIN_OPERACION", "ADMIN_VACACIONES");
      for (const grant of [
        "incidents:cancel",
        "states:read",
        "assignments:reopen",
      ]) {
        expect(
          block.includes(`"${grant}"`),
          `seed.example.ts: ADMIN_OPERACION must hold ${grant}`,
        ).toBe(true);
      }
    });

    it("an idempotent data migration grants the three permissions and bumps sessionVersion", () => {
      const matches = migrationSources().filter(
        ({ sql }) =>
          sql.includes("ADMIN_OPERACION") &&
          sql.includes("incidents:cancel") &&
          sql.includes("states:read") &&
          sql.includes("assignments:reopen") &&
          sql.includes("sessionVersion"),
      );
      expect(
        matches.map((m) => m.file),
        "a data migration must grant incidents:cancel, states:read and " +
          "assignments:reopen to ADMIN_OPERACION with a sessionVersion bump",
      ).not.toHaveLength(0);
    });

    it("ADMIN_VACACIONES configures accrual via vacations:manage", () => {
      const seed = readFileSync(SEED_TEMPLATE, "utf8");
      const block = roleBlock(seed, "ADMIN_VACACIONES", "FSR");
      expect(block.includes('"vacations:manage"')).toBe(true);
      expect(block.includes('"route:admin-vacation-accrual"')).toBe(true);
    });
  });

  describe("vacation accrual gate (vacations:manage, not settings:*)", () => {
    it("vacation-accrual-rules.ts never requires settings:*", () => {
      const source = readFileSync(ACCRUAL_RULES, "utf8");
      const gates = [...source.matchAll(/requirePermission\("([^"]+)"\)/g)].map(
        (m) => m[1],
      );
      expect(gates.length).toBeGreaterThan(0);
      for (const gate of gates) {
        expect(
          gate,
          `vacation-accrual-rules.ts must gate on vacations:manage, found ${gate}`,
        ).toBe("vacations:manage");
      }
    });

    it("the accrual page gates on its own route, not /admin/settings", () => {
      const source = readFileSync(ACCRUAL_PAGE, "utf8");
      expect(source).toContain(
        'requireRouteAccess("/admin/settings/vacation-accrual")',
      );
      expect(source).not.toContain('requireRouteAccess("/admin/settings")');
    });
  });

  describe("detail-page action buttons match the permission the action requires", () => {
    it("CancelIncidentButton only renders with incidents:cancel", () => {
      const source = readFileSync(INCIDENT_DETAIL_PAGE, "utf8");
      expect(source).toContain('canPerform("incidents:cancel")');
      expect(source).toContain("CancelIncidentButton");
    });

    it("the assignment detail screen wires reopenAssignment behind assignments:reopen", () => {
      const source = readFileSync(ASSIGNMENT_DETAIL_PAGE, "utf8");
      expect(source).toContain('canPerform("assignments:reopen")');
      // The screen renders the reopen button, which calls the
      // `reopenAssignment` action (CERRADO → EN_PROGRESO, admin-only).
      expect(
        source.includes("reopenAssignment") ||
          source.includes("ReopenAssignmentButton"),
      ).toBe(true);
    });
  });

  describe("dead actions (decision #3: CONECTAR REAPERTURA)", () => {
    it("closeIncident and refreshIncidentStatus have no references left", () => {
      const files = tsSources([
        join(ROOT, "src"),
        join(ROOT, "e2e"),
      ]);
      const offenders: string[] = [];
      for (const file of files) {
        const source = readFileSync(file, "utf8");
        if (
          /\bcloseIncident\b/.test(source) ||
          /\brefreshIncidentStatus\b/.test(source)
        ) {
          offenders.push(file);
        }
      }
      expect(offenders, "dead actions must be deleted with zero references").toEqual(
        [],
      );
    });
  });
});
