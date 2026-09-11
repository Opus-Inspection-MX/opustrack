import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWLIST,
  EXPECTED_FAIL,
  MATRIX_ALL,
  MATRIX_ROUTES,
} from "./coverage";

/**
 * Integration coverage, enforced instead of remembered.
 *
 * Every Server Action that receives an id or reads tenant rows must be
 * dispositioned in `coverage.ts`: exercised by a `*.int.test.ts` matrix or
 * sitting in the allowlist WITH its reason (global catalog, own-user rows,
 * or a TODO promoting it once its guards land). A new action that touches
 * tenant data breaks this test until it gets a matrix case or a reason —
 * the same role the Fase 0c access contract plays for guards.
 *
 * Runs in the unit project: pure static scan, no database.
 */

const ACTIONS_DIR = join(process.cwd(), "src", "lib", "actions");
const AUTH = /require(Auth|Permission|Action)\(|withPermission\(/;
const ID_PARAM = /\bid\b|Id\b/;
const TENANT_MODEL =
  /prisma\.(incident|assignment|assignmentActivity|assignmentItem|client|line|equipment|schedule|scheduleClient|vehicleTrip|incidentAttachment|assignmentAttachment|user|userRole|userClientAssignment)\b/;

interface ActionExport {
  key: string;
  file: string;
  name: string;
}

function scanActions(): ActionExport[] {
  const found: ActionExport[] = [];
  for (const file of readdirSync(ACTIONS_DIR).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  )) {
    const source = readFileSync(join(ACTIONS_DIR, file), "utf8");
    if (!source.includes('"use server"')) continue;
    const re = /export async function (\w+)\s*\(([^)]*)\)/g;
    const matches = [...source.matchAll(re)].map((m) => ({
      name: m[1] ?? "",
      args: m[2] ?? "",
      index: m.index ?? 0,
    }));
    matches.forEach(({ name, args, index }, i) => {
      if (!name) return;
      const body = source.slice(
        index,
        i + 1 < matches.length ? matches[i + 1]?.index : source.length,
      );
      if (!AUTH.test(body)) return;
      if (!ID_PARAM.test(args) && !TENANT_MODEL.test(body)) return;
      found.push({ key: `${file} :: ${name}`, file, name });
    });
  }
  return found;
}

/** Every registry key must resolve to a real export (no stale entries). */
function keyResolves(key: string): boolean {
  if (key.startsWith("app/")) {
    const [path, method] = key.split(" :: ");
    if (!path || !method) return false;
    const source = readFileSync(join(process.cwd(), "src", path), "utf8");
    return new RegExp(`export const ${method}\\b`).test(source);
  }
  if (key.startsWith("mail/")) {
    return existsSync(join(process.cwd(), "src", "lib", key.split(" :: ")[0]));
  }
  const [file, name] = key.split(" :: ");
  if (!file || !name) return false;
  const source = readFileSync(join(ACTIONS_DIR, file), "utf8");
  return new RegExp(`export async function ${name}\\b`).test(source);
}

describe("integration coverage registry", () => {
  it("every tenant/id action is in a matrix or in the allowlist with a reason", () => {
    const undispositioned = scanActions()
      .map((a) => a.key)
      .filter((key) => !MATRIX_ALL.has(key) && !(key in ALLOWLIST));
    expect(
      undispositioned,
      "Actions touching tenant data with no matrix case and no allowlist reason — add a case or a reason in coverage.ts",
    ).toEqual([]);
  });

  it("the registry has no stale entries", () => {
    const stale = [...MATRIX_ALL, ...Object.keys(ALLOWLIST)].filter(
      (key) => !keyResolves(key),
    );
    expect(stale, "Registry keys with no matching export").toEqual([]);
    const staleRoutes = [...MATRIX_ROUTES].filter((key) => !keyResolves(key));
    expect(staleRoutes, "Route keys with no matching handler").toEqual([]);
  });

  it("every expected-fail marker points at a matrix entry", () => {
    const guarded = new Set([...MATRIX_ALL, ...MATRIX_ROUTES]);
    const dangling = Object.keys(EXPECTED_FAIL).filter(
      (key) => !guarded.has(key),
    );
    expect(
      dangling,
      "EXPECTED_FAIL keys outside every matrix — the marker guards nothing",
    ).toEqual([]);
  });
});
