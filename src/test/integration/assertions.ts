import { BusinessRuleError } from "@/lib/actions/result";
import { AuthorizationError } from "@/lib/auth/auth";

/**
 * Shared assertions for the integration matrices.
 */

/** Fail when any nested object carries a `password` key (H-01). */
export function assertNoPasswordKey(value: unknown): void {
  const seen = new Set<object>();
  const walk = (node: unknown, path: string): void => {
    if (typeof node !== "object" || node === null) return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const [i, item] of node.entries()) walk(item, `${path}[${i}]`);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === "password") {
        throw new Error(`password key leaked at ${path}.${key}`);
      }
      walk(child, `${path}.${key}`);
    }
  };
  walk(value, "$");
}

/**
 * Whether an action outcome counts as a denial.
 *
 * Writes return `{ success: false }`; unguarded reads throw
 * `BusinessRuleError`; missing grants throw `AuthorizationError`; pages
 * redirect (mocked to a recognizable error); no session throws the
 * authentication error. Anything else — including `{ success: true }` —
 * is access granted.
 */
export function isDenial(outcome: unknown): boolean {
  if (
    typeof outcome === "object" &&
    outcome !== null &&
    "success" in outcome &&
    (outcome as { success: unknown }).success === false
  ) {
    return true;
  }
  return (
    outcome instanceof BusinessRuleError ||
    outcome instanceof AuthorizationError ||
    (outcome instanceof Error &&
      (/^NEXT_REDIRECT:/.test(outcome.message) ||
        outcome.message === "Authentication required"))
  );
}

/** Run `call`, capturing a throw as a value so denial checks stay uniform. */
export async function capture<T>(call: () => Promise<T>): Promise<T | Error> {
  try {
    return await call();
  } catch (error) {
    return error as Error;
  }
}
