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
const STATE_MACHINE_DIR = join(process.cwd(), "src/lib/state-machine");
// Plain helper modules that run inside actions (NOT "use server" so their
// exports do not become public actions) still throw defects with Spanish
// seed messages — the same production-invisibility rule applies to them.
const EXTRA_SCAN_FILES = [
  join(process.cwd(), "src/lib/auth/access.ts"),
  join(process.cwd(), "src/lib/auth/filters.ts"),
  join(process.cwd(), "src/lib/assignments/ensure-fsrs.ts"),
  join(process.cwd(), "src/lib/incidents/shared.ts"),
];

/**
 * Spanish messages that legitimately throw.
 *
 * Each entry is a system invariant: the database is missing something the seed
 * is supposed to create, or a not-found for a record the UI should never have
 * offered. Neither is a decision the operator can revisit, and swallowing them
 * into a toast would hide a real defect.
 *
 * Deliberately NOT here: "requerido"/"requerida". Those used to launder
 * operator-facing FormData rules (`assignmentId requerido`, `vehicleId
 * requerido`, `tripId requerido`) through this whitelist. They now go through
 * `businessRule(...)` like every other rule — if one regresses to
 * `throw new Error`, the SPANISH pattern below catches it.
 */
const ALLOWED = [
  "no existe en el catálogo",
  "no encontrado",
  "no encontrada",
  "Verifique la configuración del sistema",
  "Corre el seed",
  "Re-ejecuta el seed",
  "inválido:",
  // The assignment state machine only knows a fixed set of status names. A
  // statusId outside it means the catalog and the code disagree, not that the
  // operator picked wrong — the select never offers one.
  "AssignmentStatus '",
];

/**
 * Words that mark a string as Spanish rather than an internal English message.
 *
 * The accented-character class catches most rules, but a message can be fully
 * Spanish without one ("Sin acceso al Cliente c1", "assignmentId requerido").
 * The word list therefore also carries unaccented giveaways — each chosen so
 * no English `throw` in the scanned scope contains it as a standalone word.
 */
const SPANISH =
  /[áéíóúñ¿¡]|\b(no|se|la|el|los|las|está|están|puede|debe|deben|solo|sola|ya|para|con|sin|una|uno|unas|unos|este|esta|estos|estas|eso|falta|faltan|acceso|requerid[oa]s?|válid[oa]s?|otro|otra|entre|cada|donde|cuando|porque|desde|hasta|tiene|tienen|fue|fueron)\b/i;

function scannedSources(): string[] {
  const fromDir = (dir: string) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => join(dir, f));
  return [
    ...fromDir(ACTIONS_DIR),
    ...fromDir(STATE_MACHINE_DIR),
    ...EXTRA_SCAN_FILES,
  ];
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

    for (const file of scannedSources()) {
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
    const sources = scannedSources().map((f) => readFileSync(f, "utf8"));
    const unused = ALLOWED.filter(
      (allowed) => !sources.some((s) => s.includes(allowed)),
    );

    expect(unused, "Entradas obsoletas en la lista blanca").toEqual([]);
  });

  it("ningún action devuelve { success: true } crudo — usa ok()", () => {
    // `ok()` types the literal (`success: true as const`) so the
    // `ActionResult` union discriminates; a raw `{ success: true, ... }`
    // widens to `boolean` and `result.error` stops compiling in the failure
    // branch. One constructor, no exceptions.
    const offenders: string[] = [];

    for (const file of scannedSources()) {
      // result.ts IS the constructor — its own return is the idiom.
      if (file.endsWith("/result.ts")) continue;
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");

      lines.forEach((line, index) => {
        if (!/return\s*\{\s*success:\s*true\b/.test(line)) return;
        offenders.push(
          `${file.split("/").pop()}:${index + 1} → ${line.trim()}`,
        );
      });
    }

    expect(
      offenders,
      "Estos returns eluden ok(). Usa `ok()` u `ok({ ... })` para que el " +
        "resultado discrimine la unión ActionResult.",
    ).toEqual([]);
  });

  it("cada esquema de input está consumido por un action", () => {
    // A schema nobody parses is speculation with a maintenance cost: it
    // drifts from the payload it claims to describe (AssignmentCreateSchema
    // once required min(1) assignee while the app validly sends []) and
    // reviewers assume unparsed input is validated. Schemas live in
    // `src/lib/validations`; every one of them must be parsed by an action.
    const VALIDATIONS_DIR = join(process.cwd(), "src/lib/validations");

    // Building blocks, not input contracts: composed INTO the schemas
    // above, never parsed directly.
    const PRIMITIVES = new Set([
      "baseQuerySchema",
      "cuidSchema",
      "intIdSchema",
      "intIdStringSchema",
      "paginationSchema",
      "sortOrderSchema",
      "base64FileSchema",
      "nonEmptyStringSchema",
      "optionalStringSchema",
      "prioritySchema",
      "slaSchema",
    ]);

    // Parsed nothing yet, kept deliberately — each needs its action wired
    // before it earns the consumption rule (follow-up, not speculation:
    // the flows exist, the .parse() call does not).
    const PENDING_WIRING = new Set([
      "AssignmentCompleteSchema",
      "AssignmentStatusUpdateSchema",
      "AssignmentAttachmentSchema",
      "IncidentAssignSchema",
      "BulkIncidentTemplateRowSchema",
    ]);

    const actionSources = scannedSources().map((f) => readFileSync(f, "utf8"));
    const unconsumed: string[] = [];
    const resurrected: string[] = [];

    for (const file of readdirSync(VALIDATIONS_DIR).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    )) {
      const source = readFileSync(join(VALIDATIONS_DIR, file), "utf8");
      for (const match of source.matchAll(/export const (\w+Schema)\b/g)) {
        const name = match[1];
        if (PRIMITIVES.has(name) || PENDING_WIRING.has(name)) continue;
        // Delete/Query/ChangeStatus DTOs were removed: deletes take a scalar
        // id, lists take typed params. If one comes back it must arrive with
        // an action that parses it — the PENDING_WIRING excuse does not apply.
        if (/(Delete|Query|ChangeStatus)Schema$/.test(name)) {
          resurrected.push(`${file}:${name}`);
          continue;
        }
        const consumed = actionSources.some((s) => s.includes(name));
        if (!consumed) unconsumed.push(`${file}:${name}`);
      }
    }

    expect(
      resurrected,
      "Esquemas Delete/Query/ChangeStatus eliminados en la limpieza 2.4. " +
        "Los deletes toman un id escalar y las listas toman parámetros " +
        "tipados — no reintroducir DTOs sin un action que los parsee.",
    ).toEqual([]);
    expect(
      unconsumed,
      "Esquemas sin ningún action que los parsee. Conecta el .parse() o " +
        "elimina el esquema.",
    ).toEqual([]);
  });

  it("el factory de catálogos parsea cada payload", () => {
    // The eight catalogs delegate to `createCatalogActions`; the delegation
    // is only a guard if the factory actually parses. Structural pin so a
    // future "simplification" cannot drop the .parse() silently.
    const factory = readFileSync(
      join(process.cwd(), "src/lib/actions/catalog-factory.ts"),
      "utf8",
    );
    expect(factory.includes("schema.parse")).toBe(true);
  });
});
