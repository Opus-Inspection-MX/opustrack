import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fase 5d (H-17): soft-deleted rows stay read-only.
 *
 * A bare `findUnique({ where: { id } })` (same-model `update`/`updateMany`
 * later in the SAME function body) can reopen, edit, or fill a row that was
 * soft-deleted. New code must either filter `active: true` in the read (or
 * check `.active` explicitly before writing) or justify the exception in
 * ALLOWLIST. Stale allowlist entries fail so exceptions are revisited
 * instead of accumulating.
 *
 * Grandfathered entries predate Fase 5d: they need the 0c-style
 * ownership/scope loaders, not just the `active` filter.
 *
 * Known limit: the scan only sees top-level exported action functions, so the
 * shared `createCatalogActions` factory (lookups.ts) and non-exported helpers
 * are out of sight — the factory needs one central `active` guard instead.
 */

const ALLOWLIST: Record<string, string> = {
  "assignment-activities.ts:updateAssignmentActivity":
    "pre-5d write path; needs 0c-style guard",
  "assignment-activities.ts:deleteAssignmentActivity":
    "pre-5d write path; needs 0c-style guard",
  "assignment-items.ts:deleteAssignmentItem":
    "pre-5d write path; needs 0c-style guard",
  "assignments.ts:deleteAssignment": "pre-5d write path; needs 0c-style guard",
  "assignments.ts:deleteAssignmentAttachment":
    "pre-5d write path; needs 0c-style guard",
  "broadcasts.ts:updateBroadcast": "pre-5d write path; needs 0c-style guard",
  "broadcasts.ts:cancelBroadcast": "pre-5d write path; needs 0c-style guard",
  "equipments.ts:deleteEquipment": "pre-5d write path; needs 0c-style guard",
  "equipments.ts:toggleEquipmentStatus":
    "pre-5d write path; needs 0c-style guard",
  "incident-attachments.ts:deleteIncidentAttachment":
    "pre-5d write path; needs 0c-style guard",
  "incidents.ts:cancelIncident": "pre-5d write path; needs 0c-style guard",
  "incidents.ts:deleteIncident": "pre-5d write path; needs 0c-style guard",
  "incidents.ts:updateIncident": "pre-5d write path; needs 0c-style guard",
  "incidents.ts:updateIncidentScheduledDate":
    "pre-5d write path; needs 0c-style guard",
  "incidents.ts:updateIncidentType": "pre-5d write path; needs 0c-style guard",
  "lines.ts:toggleLineStatus": "pre-5d write path; needs 0c-style guard",
  "notification-settings.ts:retryFailedEmail":
    "EmailOutbox has no active flag by design (log-shaped retry row)",
  "schedules.ts:updateSchedule": "pre-5d write path; needs 0c-style guard",
  "tracking.ts:updateAssignmentDetails":
    "pre-5d write path; needs 0c-style guard",
  "tracking.ts:updateIncidentDetails":
    "pre-5d write path; needs 0c-style guard",
  "tracking.ts:overrideIncidentStatus":
    "pre-5d write path; needs 0c-style guard",
  "users.ts:updateMyPassword": "pre-5d write path; needs 0c-style guard",
  "vacations.ts:updatePeriodOverride":
    "VacationPeriod has no active flag (derived balance ledger row)",
};

/** Bodies of top-level `export [async] function NAME(...) ... { ... }`. */
function functionBodies(src: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const re = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    // Skip the parameter list (it may hold inline object types with braces),
    // then skip an optional return type (it may hold Promise<{...}>), so the
    // first depth-zero `{` left is the function body.
    let i = src.indexOf("(", m.index + m[0].length);
    let parens = 0;
    while (i < src.length) {
      if (src[i] === "(") parens += 1;
      else if (src[i] === ")") {
        parens -= 1;
        if (parens === 0) break;
      }
      i += 1;
    }
    i += 1;
    let angle = 0;
    let brace = 0;
    let fnParens = 0;
    let bodyStart = -1;
    while (i < src.length) {
      const c = src[i];
      if (c === "<") angle += 1;
      else if (c === ">") angle -= 1;
      else if (c === "(") fnParens += 1;
      else if (c === ")") fnParens -= 1;
      else if (c === "{") {
        if (angle === 0 && brace === 0 && fnParens === 0) {
          bodyStart = i;
          break;
        }
        brace += 1;
      } else if (c === "}") brace -= 1;
      i += 1;
    }
    if (bodyStart === -1) continue;
    let depth = 1;
    let j = bodyStart + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth += 1;
      else if (src[j] === "}") depth -= 1;
      j += 1;
    }
    bodies.set(name, src.slice(m.index, j));
  }
  return bodies;
}

/** Bare same-model id reads paired with a same-model update in one body. */
function violationsIn(body: string): Set<string> {
  const reads = new Map<string, number>();
  const readRe = /(\w+)\.findUnique\(\s*\{\s*where:\s*\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = readRe.exec(body)) !== null) {
    const [, model, where] = m;
    if (/\bid\b/.test(where) && !/\bactive\b/.test(where)) {
      reads.set(model, (reads.get(model) ?? 0) + 1);
    }
  }
  const writes = new Set<string>();
  const writeRe = /(\w+)\.update(?:Many)?\s*\(/g;
  while ((m = writeRe.exec(body)) !== null) writes.add(m[1]);
  const out = new Set<string>();
  for (const model of reads.keys()) {
    if (writes.has(model)) out.add(model);
  }
  return out;
}

describe("soft-delete write contract (Fase 5d)", () => {
  it("bare id-reads-before-write carry active or an allowlist reason", () => {
    const dir = join(__dirname);
    const found: string[] = [];
    const seen = new Set<string>();
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const src = readFileSync(join(dir, file), "utf8");
      for (const [name, body] of functionBodies(src)) {
        if (violationsIn(body).size === 0) continue;
        const key = `${file}:${name}`;
        seen.add(key);
        if (!(key in ALLOWLIST)) found.push(key);
      }
    }
    expect(
      found,
      `bare findUnique({ where: { id } }) + same-model update without active — ` +
        `add active:true (or an explicit .active check) or justify in ALLOWLIST: ${found.join(", ")}`,
    ).toEqual([]);

    const stale = Object.keys(ALLOWLIST).filter((key) => !seen.has(key));
    expect(
      stale,
      `stale allowlist entries (function now filters active — remove them): ${stale.join(", ")}`,
    ).toEqual([]);
  });
});
