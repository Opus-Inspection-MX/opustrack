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

type DedupeReader = {
  actionIdempotency: {
    findUnique: (args: { where: { key: string } }) => Promise<{
      targetId: string | null;
      actorId: string | null;
      action: string;
      requestTargetId: string | null;
    } | null>;
  };
};

export interface ReplayBinding {
  actorId: string;
  action: string;
  requestTargetId: string;
}

/**
 * Known key → live target id. The caller reloads the live row and returns
 * it WITHOUT re-executing the transition or re-firing notifications.
 */
export async function findReplayTargetId(
  db: DedupeReader,
  key: string,
  binding: ReplayBinding,
): Promise<string | null> {
  const hit = await db.actionIdempotency.findUnique({ where: { key } });
  if (
    hit &&
    (hit.actorId !== binding.actorId ||
      hit.action !== binding.action ||
      hit.requestTargetId !== binding.requestTargetId)
  ) {
    businessRule(
      "La llave de reintento no corresponde a este usuario, acción o registro. Revise el borrador antes de volver a enviarlo.",
    );
  }
  return hit?.targetId ?? null;
}

/**
 * True for Prisma unique-constraint violations: another worker claimed the
 * same idempotency key first. Callers converge on the winner's row instead
 * of surfacing a generic error.
 */
export function isP2002(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

type DedupeWriter = {
  actionIdempotency: {
    create: (args: {
      data: {
        key: string;
        action: string;
        targetId: string;
        actorId: string;
        requestTargetId: string;
      };
    }) => Promise<unknown>;
  };
};

/**
 * Claim a key for a freshly applied target. Duplicate claims propagate and
 * roll back the complete mutation. Sequential retries converge before writing;
 * concurrent losers converge outside the transaction using the bound receipt.
 *
 * Accepts any client carrying the delegate (transaction or root): the
 * assignment actions claim atomically inside their `$transaction`. Trip
 * actions claim inside their own `$transaction` directly (they need the
 * P2002 to propagate so they can delete the orphaned upload and converge).
 */
export async function claimIdempotencyKey(
  tx: DedupeWriter,
  key: string,
  action: string,
  targetId: string,
  binding: Pick<ReplayBinding, "actorId" | "requestTargetId">,
): Promise<void> {
  // A duplicate claim aborts the complete transaction. Convergence happens
  // outside the transaction after validating the committed binding again.
  await tx.actionIdempotency.create({
    data: { key, action, targetId, ...binding },
  });
}
