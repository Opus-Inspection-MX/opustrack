import { IncidentEventType, type Prisma } from "@prisma/client";
import type { prisma } from "@/lib/database/prisma.singleton";

/**
 * Single writer for the IncidentEvent append-only log (RF-219).
 *
 * Every status-affecting path funnels through here so the vocabulary stays
 * closed and payloads stay small: only allowlisted keys survive, and long
 * free-text reasons are truncated. Application code MUST never update or
 * delete event rows — enforced by the append-only unit test, not by DB
 * magic.
 */

export type EventClient = Prisma.TransactionClient | typeof prisma;

export type IncidentEventInput = {
  incidentId: number;
  eventType: IncidentEventType;
  /** Human actor. Null (default) means the change was system-driven. */
  actorId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  payload?: Record<string, unknown> | null;
};

/** Keys each event type is allowed to carry. Anything else is dropped. */
const PAYLOAD_ALLOWLIST: Record<IncidentEventType, readonly string[]> = {
  [IncidentEventType.CREATED]: ["source", "assigneeIds"],
  [IncidentEventType.STATUS_CHANGED]: [
    "resolvedAt",
    "priorResolvedAt",
    "fromStatus",
    "toStatus",
  ],
  [IncidentEventType.ASSIGNEE_ADDED]: ["userId"],
  [IncidentEventType.ASSIGNEE_REMOVED]: ["userId"],
  [IncidentEventType.ASSIGNEE_AUTO_CREATED]: ["userId", "via"],
  [IncidentEventType.ASSIGN_DENIED]: ["deniedUserId"],
  [IncidentEventType.CANCELLED]: ["reason", "fromStatus"],
  [IncidentEventType.REOPENED]: ["priorResolvedAt", "fromStatus", "toStatus"],
  [IncidentEventType.BULK_IMPORTED]: [
    "rowNumber",
    "initialStatus",
    "resolvedAt",
    "assigneeIds",
  ],
  [IncidentEventType.RECALC_SKIPPED]: [
    "fromStatus",
    "attemptedTarget",
    "reason",
  ],
  [IncidentEventType.ADMIN_OVERRIDE]: [
    "reason",
    "fromStatus",
    "toStatus",
    "priorResolvedAt",
  ],
};

const MAX_TEXT_LENGTH = 500;

function sanitizePayload(
  eventType: IncidentEventType,
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  const allowed = PAYLOAD_ALLOWLIST[eventType] ?? [];
  const clean: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = payload[key];
    if (value === undefined) continue;
    clean[key] =
      typeof value === "string" && value.length > MAX_TEXT_LENGTH
        ? value.slice(0, MAX_TEXT_LENGTH)
        : value;
  }
  return clean;
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

/**
 * Append one audit event. Join the caller's transaction where the path is
 * already transactional; otherwise call right after the write. A failed
 * mutation writes no event because the emission always comes last.
 */
export async function logIncidentEvent(
  client: EventClient,
  input: IncidentEventInput,
) {
  return client.incidentEvent.create({
    data: {
      incidentId: input.incidentId,
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      payload: sanitizePayload(input.eventType, input.payload) ?? undefined,
    },
  });
}

/**
 * Closure-timestamp precedence (RF-503/RF-509): the incident's closure
 * moment is the `createdAt` of its latest close-arriving event, NOT the
 * live `resolvedAt` column (legitimately null while reopened). Returns null
 * when the incident never closed. Pre-deploy history has no events, so old
 * rows stay approximate — no backfill by design.
 */
export async function getIncidentClosureAt(
  client: EventClient,
  incidentId: number,
): Promise<Date | null> {
  const closing = await client.incidentEvent.findFirst({
    where: {
      incidentId,
      OR: [
        {
          eventType: IncidentEventType.STATUS_CHANGED,
          toStatus: "CERRADO",
        },
        { eventType: IncidentEventType.CANCELLED },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (closing) return closing.createdAt;
  return null;
}

export { toIso };
