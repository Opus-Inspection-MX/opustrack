import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  type CreateNotificationInput,
  type GetNotificationsOptions,
  NOTIFICATION_PRIORITY,
} from "./notification-types";

/**
 * Create a notification for a user
 * Called by system when events occur (work order assignment, etc.)
 */
export async function createNotification(input: CreateNotificationInput) {
  return await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      actionUrl: input.actionUrl ?? null,
      priority: input.priority ?? NOTIFICATION_PRIORITY.LOW,
      metadata: input.metadata
        ? (input.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

/**
 * Create notifications for multiple users at once
 */
export async function createNotificationsForUsers(
  userIds: string[],
  notification: Omit<CreateNotificationInput, "userId">,
) {
  if (userIds.length === 0) return [];

  return await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      entityType: notification.entityType ?? null,
      entityId: notification.entityId ?? null,
      actionUrl: notification.actionUrl ?? null,
      priority: notification.priority ?? NOTIFICATION_PRIORITY.LOW,
      metadata: notification.metadata
        ? (notification.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    })),
  });
}

/**
 * Get notifications for a user (paginated, filtered)
 */
export async function getUserNotifications(
  userId: string,
  options: GetNotificationsOptions = {},
) {
  const { unreadOnly = false, limit = 20, offset = 0, type } = options;

  return await prisma.notification.findMany({
    where: {
      userId,
      active: true,
      ...(unreadOnly ? { isRead: false } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return await prisma.notification.count({
    where: { userId, isRead: false, active: true },
  });
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string, userId: string) {
  // Verify ownership before marking read
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId, active: true },
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  return await prisma.notification.updateMany({
    where: { userId, isRead: false, active: true },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * Delete notification (soft delete)
 */
export async function deleteNotification(
  notificationId: string,
  userId: string,
) {
  // Verify ownership before deleting
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { active: false },
  });
}

/**
 * Delete all notifications for a user (soft delete)
 */
export async function deleteAllNotifications(userId: string) {
  return await prisma.notification.updateMany({
    where: { userId, active: true },
    data: { active: false },
  });
}

/**
 * Get notification by ID (with ownership check)
 */
export async function getNotificationById(
  notificationId: string,
  userId: string,
) {
  return await prisma.notification.findFirst({
    where: { id: notificationId, userId, active: true },
  });
}
