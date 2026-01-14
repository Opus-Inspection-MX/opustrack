"use server";

import { requireAuth } from "@/lib/auth/auth";
import {
  deleteNotification,
  type GetNotificationsOptions,
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from "@/lib/notifications";

/**
 * Get current user's notifications
 */
export async function getMyNotifications(options?: GetNotificationsOptions) {
  const user = await requireAuth();
  const notifications = await getUserNotifications(user.id, options);
  return notifications;
}

/**
 * Get current user's unread count
 */
export async function getMyUnreadCount(): Promise<number> {
  const user = await requireAuth();
  return await getUnreadCount(user.id);
}

/**
 * Mark notification as read (verifies ownership)
 */
export async function markNotificationAsRead(notificationId: string) {
  const user = await requireAuth();
  const result = await markAsRead(notificationId, user.id);
  return { success: true, data: result };
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  const user = await requireAuth();
  await markAllAsRead(user.id);
  return { success: true };
}

/**
 * Delete notification (verifies ownership)
 */
export async function deleteMyNotification(notificationId: string) {
  const user = await requireAuth();
  await deleteNotification(notificationId, user.id);
  return { success: true };
}

/**
 * Get notifications with unread count (for initial render)
 */
export async function getNotificationsWithCount(
  options?: GetNotificationsOptions,
) {
  const user = await requireAuth();
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(user.id, options),
    getUnreadCount(user.id),
  ]);
  return { notifications, unreadCount };
}
