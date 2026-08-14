"use server";

import type { Prisma } from "@prisma/client";

import { requirePermission } from "@/lib/auth/auth";
import { whereHasRoleId } from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  deleteNotification,
  type GetNotificationsOptions,
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
  notifyBroadcast,
} from "@/lib/notifications";
import { type ActionResult, ok, rejected } from "./result";

/**
 * Get current user's notifications
 */
export async function getMyNotifications(options?: GetNotificationsOptions) {
  const user = await requirePermission("notifications:read");
  const notifications = await getUserNotifications(user.id, options);
  return notifications;
}

/**
 * Get current user's unread count
 */
export async function getMyUnreadCount(): Promise<number> {
  const user = await requirePermission("notifications:read");
  return await getUnreadCount(user.id);
}

/**
 * Mark notification as read (verifies ownership)
 */
export async function markNotificationAsRead(notificationId: string) {
  const user = await requirePermission("notifications:update");
  const result = await markAsRead(notificationId, user.id);
  return { success: true, data: result };
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  const user = await requirePermission("notifications:update");
  await markAllAsRead(user.id);
  return { success: true };
}

/**
 * Delete notification (verifies ownership)
 */
export async function deleteMyNotification(notificationId: string) {
  const user = await requirePermission("notifications:delete");
  await deleteNotification(notificationId, user.id);
  return { success: true };
}

/**
 * Get notifications with unread count (for initial render)
 */
export async function getNotificationsWithCount(
  options?: GetNotificationsOptions,
) {
  const user = await requirePermission("notifications:read");
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(user.id, options),
    getUnreadCount(user.id),
  ]);
  return { notifications, unreadCount };
}

// ---------------------------------------------------------------------------
// Admin broadcast (RF-469, RF-470)
// ---------------------------------------------------------------------------

export type BroadcastAudience = "all" | "by-role";
export type BroadcastType = "system" | "announcement";

export interface BroadcastInput {
  title: string;
  message: string;
  type: BroadcastType;
  audience: BroadcastAudience;
  /** Required when audience === "by-role" */
  roleId?: number;
}

export type BroadcastResult = ActionResult<{ count: number }>;

/**
 * RF-469 / RF-470: Send a broadcast notification from the admin UI.
 * Audience "all" → all active users.
 * Audience "by-role" → all active users with the selected roleId.
 * Actor is excluded by notifyBroadcast → emit().
 */
export async function sendBroadcast(
  input: BroadcastInput,
): Promise<BroadcastResult> {
  // Admin route guard is handled by requireRouteAccess on the page,
  // but we still check notifications:read so the server action itself
  // is not callable by non-authenticated users.
  const user = await requirePermission("notifications:read");

  // Input validation
  const title = input.title?.trim();
  const message = input.message?.trim();

  if (!title) {
    return rejected("El título es obligatorio");
  }
  if (!message) {
    return rejected("El mensaje es obligatorio");
  }
  if (input.type !== "system" && input.type !== "announcement") {
    return rejected("Tipo de notificación no válido");
  }
  if (input.audience === "by-role" && !input.roleId) {
    return rejected("Debe seleccionar un rol cuando la audiencia es por rol");
  }

  // Resolve recipients. ANNOUNCEMENT always targets every active user
  // regardless of the selected audience (RF-470); only SYSTEM honors the
  // by-role audience filter.
  const whereClause: Prisma.UserWhereInput =
    input.type === "announcement"
      ? { active: true }
      : input.audience === "by-role" && input.roleId
        ? { active: true, ...whereHasRoleId(input.roleId) }
        : { active: true };

  const recipients = await prisma.user.findMany({
    where: whereClause,
    select: { id: true },
  });

  const recipientIds = recipients.map((r) => r.id);

  await notifyBroadcast(input.type, recipientIds, title, message, user.id);

  // The actor is excluded from delivery by emit(); reflect that in the count.
  const deliveredCount = recipientIds.filter((id) => id !== user.id).length;

  return ok({ count: deliveredCount });
}
