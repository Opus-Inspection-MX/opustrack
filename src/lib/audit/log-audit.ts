import { AuditAction, AuditEntity, type Prisma } from "@prisma/client";
import type { prisma } from "@/lib/database/prisma.singleton";
import { isSensitiveKey, redact } from "@/lib/observability/redact";

/**
 * Single writer for the AuditLog append-only log (RF-551).
 *
 * Modeled on `logIncidentEvent` (RF-219): every attributable-management
 * write funnels through here so the entity/action vocabulary stays closed
 * and payloads stay small and PII-free. Application code MUST never update
 * or delete audit rows — enforced by the append-only unit test, not by DB
 * magic.
 *
 * Transactionality: pass the caller's transaction client. When the business
 * transaction rolls back, the audit row rolls back with it (RF-551) — never
 * write audit rows outside `tx`.
 */

export type AuditClient = Prisma.TransactionClient | typeof prisma;

export type AuditInput = {
  /**
   * Human actor. The caller MUST always provide it explicitly — `null` means
   * a system write (seed, migration, unauthenticated job) and is a conscious
   * choice, never a default. `undefined` (omitted) throws: silent null actors
   * across Server-Action/`$transaction` boundaries are exactly what RF-550
   * rejects, so they fail loud here instead of shipping silently.
   */
  actorId: string | null;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  payload?: Record<string, unknown> | null;
};

/** Largest payload string kept verbatim; longer values are cut (RF-553). */
export const MAX_AUDIT_TEXT_LENGTH = 4096;

/** Suffix marking a truncated value. The original length is unrecoverable. */
export const TRUNCATED_SUFFIX = "…[TRUNCATED]";

/**
 * Keys each audited entity is allowed to carry. Anything else is dropped.
 * Every key here is provably non-sensitive: `audit-matrix.test.ts` asserts
 * no allowlisted key matches the redact DENYLIST, so allowlist hygiene is
 * enforced by test, not by review discipline. Identifiers and status refs
 * only — free text (names, descriptions, notes) never enters the audit log.
 */
export const AUDIT_PAYLOAD_ALLOWLIST: Record<AuditEntity, readonly string[]> = {
  [AuditEntity.CLIENT]: ["code", "stateId", "active"],
  [AuditEntity.INCIDENT]: [
    "statusId",
    "typeId",
    "lineId",
    "equipmentId",
    "scheduleId",
    "clientId",
    "active",
    "reason",
  ],
  [AuditEntity.ASSIGNMENT]: [
    "statusId",
    "incidentId",
    "scheduledDate",
    "folio",
    "odtFolio",
    "active",
    "reason",
  ],
  [AuditEntity.LINE]: ["clientId", "active", "reason"],
  [AuditEntity.EQUIPMENT]: ["lineId", "statusId", "active", "reason"],
  [AuditEntity.VEHICLE]: ["statusId", "assignedFsrId", "active", "reason"],
  [AuditEntity.VEHICLE_TRIP]: [
    "vehicleId",
    "assignmentId",
    "statusId",
    "active",
    "reason",
  ],
  [AuditEntity.SCHEDULE]: [
    "statusId",
    "scheduledAt",
    "endDate",
    "active",
    "reason",
  ],
  // Phase 2 channel matrix: identifiers and switches only, no free text.
  [AuditEntity.NOTIFICATION_CHANNEL]: ["type", "inApp", "email", "reason"],
};

function truncateValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > MAX_AUDIT_TEXT_LENGTH
      ? value.slice(0, MAX_AUDIT_TEXT_LENGTH) + TRUNCATED_SUFFIX
      : value;
  }
  if (Array.isArray(value)) return value.map(truncateValue);
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = truncateValue(entry);
    }
    return out;
  }
  return value;
}

function sanitizePayload(
  entity: AuditEntity,
  payload: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (!payload) return undefined;
  const allowed = AUDIT_PAYLOAD_ALLOWLIST[entity] ?? [];
  const clean: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = payload[key];
    if (value === undefined) continue;
    // DENY wins over the allowlist (defense in depth): a sensitive key that
    // ever slips into the allowlist is dropped, never persisted.
    if (isSensitiveKey(key)) continue;
    clean[key] = value;
  }
  // Recursive pass: nested sensitive leaves become [REDACTED] and long
  // strings are capped, BEFORE anything reaches the database.
  const redacted = redact(clean);
  return truncateValue(redacted) as Prisma.InputJsonValue;
}

/**
 * Append one audit row inside the caller's transaction. Emitted last, after
 * the business write succeeds — a failed mutation writes no audit row.
 */
export async function logAudit(client: AuditClient, input: AuditInput) {
  if (input.actorId === undefined) {
    throw new Error(
      "logAudit requires an explicit actorId (use null for system writes).",
    );
  }
  if (!Object.values(AuditEntity).includes(input.entity)) {
    throw new Error(
      `logAudit rejected unknown entity: ${String(input.entity)}.`,
    );
  }
  if (!Object.values(AuditAction).includes(input.action)) {
    throw new Error(
      `logAudit rejected unknown action: ${String(input.action)}.`,
    );
  }
  return client.auditLog.create({
    data: {
      actorId: input.actorId,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      payload: sanitizePayload(input.entity, input.payload),
    },
  });
}
