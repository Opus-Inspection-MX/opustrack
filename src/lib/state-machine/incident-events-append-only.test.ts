import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RF-219 append-only guarantee: application code MUST never update or delete
 * IncidentEvent rows. The log is observability, not authority — a future
 * edit that mutates history must fail loudly here instead of shipping
 * silently.
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

describe("IncidentEvent append-only (RF-219)", () => {
  it("no application code updates or deletes event rows", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      lines.forEach((line, index) => {
        if (
          /incidentEvent\s*\.\s*(update|updateMany|delete|deleteMany|upsert)\b/.test(
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
      "IncidentEvent rows are append-only. Fix the writer to emit a new event instead of mutating history.",
    ).toEqual([]);
  });
});
