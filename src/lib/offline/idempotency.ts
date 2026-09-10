import { businessRule } from "@/lib/actions/result";

/**
 * Server half of offline draft-and-retry (RF-260, RF-261).
 *
 * Every one of the four field actions accepts two OPTIONAL top-level
 * FormData entries, so existing online callers are untouched:
 *
 * - `idempotencyKey`: deduped via `ActionIdempotency`. A repeat key returns
 *   the live target instead of re-executing the transition.
 * - `capturedAt`: ISO timestamp of the field moment. Drafts older than the
 *   freshness window are rejected with an operator-facing Spanish message.
 *
 * Past these two checks the action runs its EXISTING guards and transitions
 * byte-for-byte — offline confers no privilege, it only delivers late.
 */

/** Freshness window: drafts older than this are rejected (RF-260 rule). */
export const OFFLINE_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/** Clock-skew tolerance for slightly future-dated captures. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface OfflineFields {
  idempotencyKey?: string;
  capturedAt?: string;
}

/** Read the optional offline fields from an action's FormData. */
export function readOfflineFields(formData: FormData): OfflineFields {
  const rawKey = formData.get("idempotencyKey");
  const rawAt = formData.get("capturedAt");
  const out: OfflineFields = {};
  if (typeof rawKey === "string" && rawKey.trim() !== "") {
    out.idempotencyKey = rawKey.trim();
  }
  if (typeof rawAt === "string" && rawAt.trim() !== "") {
    out.capturedAt = rawAt.trim();
  }
  return out;
}

/**
 * Enforce the 24h freshness window on a draft's action-time timestamp.
 * Business rules are RETURNED/RAISED, never thrown as plain Errors
 * (production Next strips thrown messages) — hence `businessRule`.
 */
export function assertOfflineFreshness(
  capturedAt: string,
  now: number = Date.now(),
): void {
  const at = Date.parse(capturedAt);
  if (!Number.isFinite(at)) {
    businessRule("Fecha de captura inválida. Vuelve a capturar la acción.");
  }
  if (at > now + FUTURE_TOLERANCE_MS) {
    businessRule("Fecha de captura inválida. Vuelve a capturar la acción.");
  }
  if (now - at > OFFLINE_FRESHNESS_MS) {
    businessRule(
      "El registro es de hace más de 24 horas y ya no puede enviarse. Capture la acción de nuevo.",
    );
  }
}
