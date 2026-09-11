import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The stable-identity contract (Fase 3, H-08/H-09).
 *
 * State and role rows are identified by their immutable `code`, never by the
 * editable `name` label: renaming "ACTIVO" once locked everybody out, and
 * renaming "FSR"/"CERRADO" silently broke logic. Like `ui-style.test.ts`,
 * this fails the suite on new violations instead of asking reviewers to
 * remember the rule.
 *
 * Forbidden in `src` (outside tests):
 *  1. `status.name ==/!= ...` (and `Status`, `userStatus`, optional chains):
 *     logic resolves by `codeOf(...)` + the `is*` helpers in
 *     `lib/constants/status-codes.ts`. Display may still RENDER the label.
 *  2. `whereHasRole("...")` with a raw string: callers pass a `ROLE.*`
 *     constant from `lib/authz/roles.ts`.
 *  3. Relation filters on the label — `status: { name: <literal|CONST|{|[> }`
 *     and the same for `role:` — queries filter on `code`. Type annotations
 *     (`{ name: string }`) and variables (`name: roleCode`) do not match:
 *     the sanctioned `code`-first-with-`name`-fallback in `user-queries.ts`
 *     passes because its fallback value is a lowercase identifier.
 *
 * The allowlist is EMPTY: every pre-existing violation was migrated.
 * A new entry needs a comment explaining why the label is load-bearing.
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const RULES: Array<{ name: string; pattern: RegExp }> = [
  {
    name: "status-name-comparison",
    pattern: /(status|Status)\??\.name\s*[!=]==/,
  },
  {
    name: "whereHasRole-literal",
    pattern: /whereHasRole\(\s*"/,
  },
  {
    name: "status-label-filter",
    pattern: /status:\s*\{\s*name\s*:\s*(["'`{[]|[A-Z])/,
  },
  {
    name: "role-label-filter",
    pattern: /role:\s*\{\s*name\s*:\s*(["'`{[]|[A-Z])/,
  },
];

const ALLOWLIST: Record<string, string[]> = {
  // Allowlist is empty by design (see header). Shape kept so a future
  // exception is explicit: { "src/path/file.ts": ["rule-name:<match>"] }.
};

function scannedFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      found.push(full);
    }
  };
  walk(SRC);
  return found.sort();
}

describe("stable status/role identity contract", () => {
  it("has no name-based identity comparisons or filters", () => {
    const violations: string[] = [];
    for (const full of scannedFiles()) {
      const rel = relative(ROOT, full);
      const source = readFileSync(full, "utf8");
      const allowed = new Set(ALLOWLIST[rel] ?? []);
      const lines = source.split("\n");
      for (const rule of RULES) {
        lines.forEach((line, index) => {
          // Skip full-line comments: prose about the old bug is not the bug.
          if (/^\s*(\*|\/\/)/.test(line)) return;
          const match = line.match(rule.pattern);
          if (match && !allowed.has(`${rule.name}:${match[0]}`)) {
            violations.push(
              `${rel}:${index + 1} [${rule.name}] ${line.trim()}`,
            );
          }
        });
      }
    }
    expect(violations).toEqual([]);
  });

  it("allowlist has no dead entries", () => {
    const seen = new Set(scannedFiles().map((f) => relative(ROOT, f)));
    for (const rel of Object.keys(ALLOWLIST)) {
      expect(seen.has(rel)).toBe(true);
    }
  });
});
