import { prisma } from "@/lib/database/prisma.singleton";
import { enqueueAndSend } from "@/lib/mail/outbox";
import { renderEmail } from "@/lib/mail/templates";
import { logger } from "@/lib/observability/logger";
import { type EventRenderContext, NOTIFICATION_EVENTS } from "./catalog";
import { createNotificationsForUsers } from "./notification-service";
import type {
  EntityType,
  NotificationPriority,
  NotificationType,
} from "./notification-types";

/**
 * The one funnel every notification event flows through.
 *
 * `dispatch` dedupes the recipients, excludes the actor (unless the caller
 * opts them back in), renders the copy from the catalog, then consults the
 * channel policy: in-app rows go through `createNotificationsForUsers`, mail
 * goes through the outbox (queued, then sent immediately). NEVER throws — a
 * notification failure must never roll back the business operation behind it.
 *
 * Policy lookup is cached in memory for 60 s; `clearChannelPolicyCache()`
 * invalidates it after the matrix save. A missing row or a failed lookup
 * falls back to the catalog defaults, so a fresh database (seed not yet run)
 * behaves exactly like a seeded one.
 */

export interface DispatchEntity {
  type: EntityType;
  id: string;
}

export interface DispatchOptions {
  recipients: string[];
  actorId: string | null;
  ctx: EventRenderContext;
  /** Keep the actor in the audience (e.g. "send me a copy"). Default false. */
  includeActor?: boolean;
  entity?: DispatchEntity;
  broadcastId?: string;
}

interface ChannelPolicy {
  inApp: boolean;
  email: boolean;
}

const POLICY_TTL_MS = 60_000;

let policyCache: { at: number; rows: Map<string, ChannelPolicy> } | null = null;

/** Drop the cached policy. Called after the matrix save. */
export function clearChannelPolicyCache(): void {
  policyCache = null;
}

async function loadPolicies(): Promise<Map<string, ChannelPolicy>> {
  if (policyCache && Date.now() - policyCache.at < POLICY_TTL_MS) {
    return policyCache.rows;
  }
  const rows = new Map<string, ChannelPolicy>();
  try {
    const policies = await prisma.notificationChannelPolicy.findMany();
    for (const p of policies)
      rows.set(p.type, { inApp: p.inApp, email: p.email });
  } catch (error) {
    logger.error("[dispatch] Error loading channel policy:", error);
  }
  policyCache = { at: Date.now(), rows };
  return rows;
}

/** Policy for one event, falling back to the catalog defaults. */
export async function getEventChannels(
  type: NotificationType,
): Promise<ChannelPolicy> {
  const rows = await loadPolicies();
  return rows.get(type) ?? { ...NOTIFICATION_EVENTS[type].defaultChannels };
}

function resolveAudience(
  recipients: string[],
  actorId: string | null,
  includeActor?: boolean,
): string[] {
  const deduped = [...new Set(recipients)].filter(Boolean);
  return includeActor ? deduped : deduped.filter((id) => id !== actorId);
}

async function sendEmailChannel(
  type: NotificationType,
  userIds: string[],
  subject: string,
  intro: string,
  actionUrl: string | null,
  broadcastId?: string,
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, active: true },
      select: { email: true },
    });
    const addresses = users.map((u) => u.email).filter(Boolean);
    if (addresses.length === 0) return;
    const rendered = renderEmail({ subject, intro, link: actionUrl });
    await enqueueAndSend({
      notificationType: type,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      recipients: addresses,
      broadcastId,
    });
  } catch (error) {
    logger.error("[dispatch] Error queueing event email:", error);
  }
}

export async function dispatch(
  type: NotificationType,
  options: DispatchOptions,
): Promise<void> {
  try {
    const audience = resolveAudience(
      options.recipients,
      options.actorId,
      options.includeActor,
    );
    if (audience.length === 0) return;

    const def = NOTIFICATION_EVENTS[type];
    const rendered = def.render(options.ctx);
    const channels = await getEventChannels(type);
    if (!channels.inApp && !channels.email) return;

    const priority: NotificationPriority = def.priority;

    if (channels.inApp) {
      try {
        await createNotificationsForUsers(audience, {
          title: rendered.title,
          message: rendered.message,
          type,
          entityType: options.entity?.type,
          entityId: options.entity?.id,
          actionUrl: rendered.actionUrl ?? undefined,
          priority,
        });
      } catch (error) {
        // Mail is the secondary channel, but it must not depend on the
        // primary succeeding: a failed in-app write still sends the mail.
        logger.error("[dispatch] Error creating notifications:", error);
      }
    }

    if (channels.email) {
      await sendEmailChannel(
        type,
        audience,
        rendered.email.subject,
        rendered.email.intro,
        rendered.actionUrl,
        options.broadcastId,
      );
    }
  } catch (error) {
    logger.error("[dispatch] Error dispatching notification:", error);
  }
}
