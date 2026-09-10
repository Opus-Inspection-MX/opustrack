import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RF-552 append-only guarantee: application code MUST never update or delete
 * AuditLog rows. The log is observability, not authority — a future edit
 * that mutates history must fail loudly here instead of shipping silently.
 *
 * Mirrors the RF-219 `incident-events-append-only.test.ts` pattern.
 */

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("AuditLog append-only (RF-552)", () => {
  it("no application code updates or deletes audit rows", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      lines.forEach((line, index) => {
        if (
          /auditLog\s*\.\s*(update|updateMany|delete|deleteMany|upsert)\b/.test(
            line,
          )
        ) {
          offenders.push(
            `${file.split("src/").pop()}:${index + 1} → ${line.trim()}`,
          );
        }
      });
    }

    expect(
      offenders,
      "AuditLog rows are append-only. Fix the writer to emit a new row instead of mutating history.",
    ).toEqual([]);
  });
});
