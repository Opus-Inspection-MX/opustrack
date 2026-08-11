import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The convention, enforced instead of remembered.
 *
 * A production build of Next replaces the message of anything a Server Action
 * throws. So a rule written for the operator must be RETURNED (`rejected`) or
 * RAISED as a `BusinessRuleError` (`businessRule`) and converted at the action
 * boundary by `guarded`. A plain `throw new Error("mensaje en español")` inside
 * an action compiles, passes review, works in `next dev`, and is invisible in
 * production — which is exactly why a human reviewer cannot be the check.
 *
 * The heuristic is the language: Spanish text is written for the user, English
 * text describes a defect (a missing seed row, a broken invariant) and should
 * keep throwing.
 */

const ACTIONS_DIR = join(process.cwd(), "src/lib/actions");

/**
 * Spanish messages that legitimately throw.
 *
 * Each entry is a system invariant: the database is missing something the seed
 * is supposed to create, or a not-found for a record the UI should never have
 * offered. Neither is a decision the operator can revisit, and swallowing them
 * into a toast would hide a real defect.
 */
const ALLOWED = [
  "no existe en el catálogo",
  "no encontrado",
  "no encontrada",
  "Verifique la configuración del sistema",
  "Corre el seed",
  "Re-ejecuta el seed",
  "requerido",
  "requerida",
  "inválido:",
  // The assignment state machine only knows a fixed set of status names. A
  // statusId outside it means the catalog and the code disagree, not that the
  // operator picked wrong — the select never offers one.
  "AssignmentStatus '",
];

/** Words that mark a string as Spanish rather than an internal English message. */
const SPANISH =
  /[áéíóúñ¿¡]|\b(no|se|la|el|los|las|está|puede|debe|solo|ya|para|con)\b/i;

function actionFiles(): string[] {
  return readdirSync(ACTIONS_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(ACTIONS_DIR, f));
}

/** Every `throw new Error("…")` literal in a file, with its line number. */
function thrownMessages(source: string): Array<{ line: number; text: string }> {
  const found: Array<{ line: number; text: string }> = [];
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    if (!line.includes("throw new Error(")) return;

    // The message may sit on the same line or the next one.
    const candidate = `${line} ${lines[index + 1] ?? ""}`;
    // Backticks are matched first and separately: a template literal often
    // contains double quotes (`Falta el tipo "${NAME}" en el catálogo`), and a
    // single alternation would truncate the message at the first one — hiding
    // the very words the whitelist matches on.
    const match =
      candidate.match(/throw new Error\(\s*`([^`]+)`/) ??
      candidate.match(/throw new Error\(\s*"([^"]+)"/);
    if (match) {
      found.push({ line: index + 1, text: match[1] });
    }
  });

  return found;
}

describe("contrato de errores de los Server Actions", () => {
  it("ninguna regla en español se lanza en vez de devolverse", () => {
    const offenders: string[] = [];

    for (const file of actionFiles()) {
      const source = readFileSync(file, "utf8");

      for (const { line, text } of thrownMessages(source)) {
        if (!SPANISH.test(text)) continue;
        if (ALLOWED.some((allowed) => text.includes(allowed))) continue;

        offenders.push(`${file.split("/").pop()}:${line} → "${text}"`);
      }
    }

    expect(
      offenders,
      "Estas reglas se pierden en producción. Usa `rejected(...)` si el flujo " +
        "puede devolver, o `businessRule(...)` dentro de un guard o una " +
        "transacción, con la acción envuelta en `guarded(...)`.",
    ).toEqual([]);
  });

  it("la lista blanca sigue describiendo invariantes reales", () => {
    // A whitelist nobody prunes becomes a way to opt out of the rule. If an
    // entry stops matching anything, it is dead and should go.
    const sources = actionFiles().map((f) => readFileSync(f, "utf8"));
    const unused = ALLOWED.filter(
      (allowed) => !sources.some((s) => s.includes(allowed)),
    );

    expect(unused, "Entradas obsoletas en la lista blanca").toEqual([]);
  });
});
