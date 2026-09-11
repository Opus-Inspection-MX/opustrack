import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The style contract, enforced instead of remembered.
 *
 * OpusTrack renders through semantic tokens (`--success`, `--status-*`,
 * `--sla-*`, `--chart-*`) so the Claro, Oscuro and Opus themes stay in sync.
 * A raw hex or a raw palette class (`text-red-500`, `bg-green-100`) outside
 * the token layer compiles, looks right in one theme, and breaks the other
 * two — which is exactly why a human reviewer cannot be the check.
 *
 * Like `actions-contract.test.ts`: new violations fail the suite. The
 * allowlist below pins every violation that already existed when Fase 1
 * landed; Fase 4 removes them area by area, shrinking this file.
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const ALLOWLIST_PATH = join(ROOT, "src/test/ui-style-allowlist.json");

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RAW_PALETTE = /(text|bg|border)-(red|green|blue|gray|yellow)-\d{2,3}\b/g;

// Token definitions and shadcn primitives are the only places allowed to
// carry raw color by construction.
const EXEMPT_PREFIXES = ["src/components/ui/"];
const EXEMPT_FILES = new Set(["src/app/globals.css"]);

type Allowlist = Record<string, string[]>;

function scannedFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|css)$/.test(entry)) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      if (entry.endsWith(".d.ts")) continue;
      const rel = relative(ROOT, full);
      if (EXEMPT_FILES.has(rel)) continue;
      if (EXEMPT_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
      found.push(full);
    }
  };
  walk(SRC);
  return found.sort();
}

function violationsIn(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.match(HEX) ?? []) found.add(match);
  for (const match of source.match(RAW_PALETTE) ?? []) found.add(match);
  return [...found].sort();
}

describe("ui style contract", () => {
  it("no agrega hex ni paleta cruda fuera de los tokens", () => {
    const allowlist: Allowlist = JSON.parse(
      readFileSync(ALLOWLIST_PATH, "utf8"),
    );
    const extras: string[] = [];
    const seen = new Set<string>();

    for (const full of scannedFiles()) {
      const rel = relative(ROOT, full);
      seen.add(rel);
      const allowed = new Set(allowlist[rel] ?? []);
      for (const match of violationsIn(readFileSync(full, "utf8"))) {
        if (!allowed.has(match)) {
          extras.push(`${rel}: ${match}`);
        }
      }
    }

    expect(
      extras,
      `Nuevos colores crudos fuera de ui/globals:\n${extras.join("\n")}\n` +
        `Usa los tokens semánticos (--success, --status-*, --sla-*, --chart-*) ` +
        `o actualiza src/test/ui-style-allowlist.json si es legado en migración.`,
    ).toEqual([]);
  });

  it("la allowlist no conserva entradas obsoletas", () => {
    const allowlist: Allowlist = JSON.parse(
      readFileSync(ALLOWLIST_PATH, "utf8"),
    );
    const stale: string[] = [];
    const existing = new Set(scannedFiles().map((f) => relative(ROOT, f)));

    for (const [rel, allowed] of Object.entries(allowlist)) {
      if (!existing.has(rel)) {
        stale.push(`${rel}: archivo ya no escaneado`);
        continue;
      }
      const current = new Set(
        violationsIn(readFileSync(join(ROOT, rel), "utf8")),
      );
      for (const match of allowed) {
        if (!current.has(match)) stale.push(`${rel}: ${match}`);
      }
    }

    expect(
      stale,
      `Entradas obsoletas en src/test/ui-style-allowlist.json:\n${stale.join("\n")}`,
    ).toEqual([]);
  });
});
