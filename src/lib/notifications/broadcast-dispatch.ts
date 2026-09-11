import { BroadcastStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";
import { broadcastAudience } from "./audiences";
import { dispatch } from "./dispatch";
import { ENTITY_TYPES, NOTIFICATION_TYPES } from "./notification-types";

/**
 * Shared broadcast delivery (Phase 4; the Phase 5 cron calls this too).
 *
 * Recipients resolve AT SEND TIME from the broadcast's stored audience, never
 * from whatever held the roles when the admin clicked save. Delivery starts
 * with an atomic claim (`PROGRAMADA → ENVIANDO` via a single `updateMany`):
 * the row that loses the race sees `count: 0` and sends nothing, so two cron
 * runs deliver exactly once. ANNOUNCEMENT honors the same audience — the kind
 * only picks the catalog entry (priority/label), unlike the legacy path that
 * forced every announcement to all users.
 *
 * Parte C: the audience is the union of the role pivot (`BroadcastRole`) and
 * the direct-user pivot (`BroadcastUser`), both read with `active` only — a
 * user deactivated between scheduling and send receives nothing. Reach is NOT
 * revalidated here: it was checked at create/edit time (decision #3), so a
 * user who lost the role still gets this one.
 *
 * Never throws: a delivery failure marks the row FALLIDA instead of rolling
 * back the caller (the "send now" action already committed the broadcast).
 */

export interface BroadcastDispatchResult {
  broadcastId: string;
  /** False when another run claimed it first (or it is no longer due). */
  claimed: boolean;
  /** Recipients after the sender rule (0 when unclaimed or failed). */
  delivered: number;
}

/** Recipients after the sender rule, matching what `dispatch` delivers. */
function deliveredAudience(
  audience: string[],
  senderId: string | null,
  includeSender: boolean,
): string[] {
  const deduped = [...new Set(audience)].filter(Boolean);
  return includeSender ? deduped : deduped.filter((id) => id !== senderId);
}

/**
 * Send one broadcast: claim it, resolve its audience, deliver, record.
 * Idempotent per row — a second call after the claim is a no-op.
 */
export async function dispatchBroadcast(
  broadcastId: string,
): Promise<BroadcastDispatchResult> {
  const idle: BroadcastDispatchResult = {
    broadcastId,
    claimed: false,
    delivered: 0,
  };
  try {
    const claim = await prisma.broadcast.updateMany({
      where: { id: broadcastId, status: BroadcastStatus.PROGRAMADA },
      data: { status: BroadcastStatus.ENVIANDO },
    });
    if (claim.count === 0) return idle;
  } catch (error) {
    logger.error("[broadcast-dispatch] Error claiming broadcast:", error);
    return idle;
  }

  try {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: {
        roles: { where: { active: true }, select: { roleId: true } },
        users: { where: { active: true }, select: { userId: true } },
      },
    });
    if (!broadcast || !broadcast.active) {
      await markBroadcast(broadcastId, BroadcastStatus.FALLIDA, 0);
      return { broadcastId, claimed: true, delivered: 0 };
    }

    const audience = await broadcastAudience(
      broadcast.allRoles
        ? { all: true, roleIds: [] }
        : {
            all: false,
            roleIds: broadcast.roles.map((r) => r.roleId),
            userIds: broadcast.users.map((u) => u.userId),
          },
    );
    const delivered = deliveredAudience(
      audience,
      broadcast.createdById,
      broadcast.includeSender,
    );

    await dispatch(
      broadcast.kind === "ANNOUNCEMENT"
        ? NOTIFICATION_TYPES.ANNOUNCEMENT
        : NOTIFICATION_TYPES.SYSTEM,
      {
        recipients: audience,
        actorId: broadcast.createdById,
        includeActor: broadcast.includeSender,
        ctx: { title: broadcast.title, message: broadcast.message },
        entity: { type: ENTITY_TYPES.BROADCAST, id: broadcastId },
        broadcastId,
        channels: {
          inApp: broadcast.sendInApp,
          email: broadcast.sendEmail,
        },
      },
    );

    await markBroadcast(broadcastId, BroadcastStatus.ENVIADA, delivered.length);
    return { broadcastId, claimed: true, delivered: delivered.length };
  } catch (error) {
    logger.error("[broadcast-dispatch] Error sending broadcast:", error);
    await markBroadcast(broadcastId, BroadcastStatus.FALLIDA, 0);
    return { broadcastId, claimed: true, delivered: 0 };
  }
}

async function markBroadcast(
  broadcastId: string,
  status: BroadcastStatus,
  recipientCount: number,
): Promise<void> {
  try {
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status,
        recipientCount,
        ...(status === BroadcastStatus.ENVIADA ? { sentAt: new Date() } : {}),
      },
    });
  } catch (error) {
    logger.error(
      "[broadcast-dispatch] Error recording broadcast result:",
      error,
    );
  }
}

/**
 * Send every due broadcast (PROGRAMADA with `scheduledAt` past), oldest
 * first. Sequential — not parallel — so one poisoned row cannot stampede the
 * outbox, and per-row errors stay isolated (each `dispatchBroadcast` absorbs
 * its own). This is what the Phase 5 cron endpoint calls; there is no HTTP
 * endpoint yet.
 */
export async function dispatchDueBroadcasts(
  now: Date = new Date(),
): Promise<BroadcastDispatchResult[]> {
  try {
    const due = await prisma.broadcast.findMany({
      where: {
        status: BroadcastStatus.PROGRAMADA,
        active: true,
        scheduledAt: { lte: now },
      },
      select: { id: true },
      orderBy: { scheduledAt: "asc" },
    });
    const results: BroadcastDispatchResult[] = [];
    for (const row of due) {
      results.push(await dispatchBroadcast(row.id));
    }
    return results;
  } catch (error) {
    logger.error("[broadcast-dispatch] Error listing due broadcasts:", error);
    return [];
  }
}
