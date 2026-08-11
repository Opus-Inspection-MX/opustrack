import { describe, expect, it } from "vitest";
import { type ActionResult, isFailure, ok, rejected } from "./result";

/**
 * The contract every business rule travels on.
 *
 * The tests that matter here are about the TYPE as much as the value: the union
 * has to discriminate, because that is the property a plain `success: boolean`
 * silently loses — and losing it is what let a rejection be treated as a
 * success at the call site.
 */

describe("ok", () => {
  it("marca éxito sin datos", () => {
    expect(ok()).toEqual({ success: true });
  });

  it("adjunta los datos al resultado", () => {
    expect(ok({ assignment: { id: "a1" } })).toEqual({
      success: true,
      assignment: { id: "a1" },
    });
  });
});

describe("rejected", () => {
  it("lleva el motivo que el usuario debe leer", () => {
    expect(rejected("No se puede eliminar")).toEqual({
      success: false,
      error: "No se puede eliminar",
    });
  });
});

/**
 * Stands in for a Server Action.
 *
 * Assigning `rejected(...)` to a variable directly would let TypeScript narrow
 * it by the initializer and the test would prove nothing about the union — the
 * declared return type of a function is what call sites actually see.
 */
function action(fail: boolean): ActionResult<{ id: number }> {
  return fail ? rejected("motivo") : ok({ id: 1 });
}

describe("discriminación de la unión", () => {
  it("permite leer error solo en la rama de fallo", () => {
    const result = action(true);

    if (result.success) {
      // Narrowed to the success branch: `id` exists, `error` does not.
      expect(result.id).toBeDefined();
      return;
    }

    // Narrowed to the failure branch. Without `success: true as const` in `ok`
    // this line does not compile — `error` would not exist on the union.
    expect(result.error).toBe("motivo");
  });

  it("isFailure estrecha el tipo para quien solo maneja el rechazo", () => {
    const success = action(false);
    const failure = action(true);

    expect(isFailure(success)).toBe(false);
    expect(isFailure(failure)).toBe(true);

    if (isFailure(failure)) {
      expect(failure.error).toBe("motivo");
    }
  });
});
