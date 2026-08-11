/**
 * The return contract for Server Actions that enforce business rules.
 *
 * Rules the operator can act on are RETURNED, never thrown. A production build
 * of Next replaces the message of anything a Server Action throws with "An
 * error occurred in the Server Components render. The specific message is
 * omitted in production builds…", so a thrown rule reaches the UI under
 * `next dev` and silently disappears under `next start` — which is what ships.
 * A returned value crosses the boundary untouched.
 *
 * What still throws: seed invariants, `requirePermission` failures (they must
 * stay exceptions so the redirect happens), and infrastructure wrappers. Those
 * are defects or authentication, not decisions the user can revisit, and a
 * toast would only hide them.
 */

export type ActionFailure = { success: false; error: string };

export type ActionResult<T extends object = object> =
  | ({ success: true } & T)
  | ActionFailure;

/**
 * A successful result, optionally carrying data.
 *
 * `success: true as const` is not cosmetic: without the literal type the union
 * does not discriminate, and `result.error` fails to compile in the failure
 * branch even after checking `!result.success`.
 */
export function ok(): { success: true };
export function ok<T extends object>(data: T): { success: true } & T;
export function ok<T extends object>(data?: T) {
  return { success: true as const, ...((data ?? {}) as T) };
}

/** A rejected business rule, with the reason the user is meant to read. */
export function rejected(error: string): ActionFailure {
  return { success: false, error };
}

/**
 * A business rule raised from somewhere that cannot return.
 *
 * Two places make `return rejected(...)` impossible:
 *
 * - **Shared guards** (`assertAssigneesAreFsrs`, `assertAssignmentEditable`).
 *   Returning would force every caller to check and re-propagate, and a guard
 *   whose result can be ignored is not a guard.
 * - **Inside `prisma.$transaction`**. Returning from the callback COMMITS the
 *   transaction; only throwing rolls it back. A rule that fires after a write
 *   must throw or it corrupts data.
 *
 * So those throw this, and `guarded()` turns it back into a value at the action
 * boundary — where the client is waiting.
 */
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

/** Raise a business rule from a guard or a transaction. */
export function businessRule(message: string): never {
  throw new BusinessRuleError(message);
}

/**
 * Run an action body and convert a raised business rule into a returned one.
 *
 * Everything else keeps propagating untouched: seed invariants, Prisma faults,
 * `requirePermission` redirects and `redirect()` itself all still throw, which
 * is what they must do.
 */
export async function guarded<T extends object>(
  run: () => Promise<T | ActionFailure>,
): Promise<ActionResult<T>> {
  try {
    const result = await run();
    return isFailure(result) ? result : ok(result as T);
  } catch (error) {
    if (error instanceof BusinessRuleError) {
      return rejected(error.message);
    }
    throw error;
  }
}

/**
 * Narrowing helper for call sites that only care about the failure branch.
 *
 * Takes `unknown` on purpose: an action that ends in `redirect()` never returns
 * on the happy path, so its type is `ActionFailure | void`. One check that
 * covers both shapes keeps every call site identical, whether the action
 * navigates on success or not.
 */
export function isFailure(result: unknown): result is ActionFailure {
  return (
    typeof result === "object" &&
    result !== null &&
    "success" in result &&
    (result as { success: unknown }).success === false
  );
}
