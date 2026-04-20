"use client";

import { NotificationList } from "@/components/notifications/notification-list";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: Date;
  priority: number;
}

interface Props {
  notifications: Notification[];
  unreadCount: number;
}

export function NotificationsPageClient({ notifications, unreadCount }: Props) {
  return (
    <NotificationList
      initialNotifications={notifications}
      initialUnreadCount={unreadCount}
      onClose={() => {}}
    />
  );
}
