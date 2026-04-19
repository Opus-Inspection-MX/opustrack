"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  canShowBrowserNotifications,
  requestNotificationPermission,
  showBrowserNotification,
} from "@/lib/notifications/browser-notifications";
import { NotificationList } from "./notification-list";

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

interface NotificationBellProps {
  initialNotifications?: Notification[];
  initialUnreadCount?: number;
}

export function NotificationBell({
  initialNotifications = [],
  initialUnreadCount = 0,
}: NotificationBellProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] =
    useState<Notification[]>(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(
    initialNotifications.length === 0 && initialUnreadCount === 0,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track notification IDs we've already shown browser notifications for
  const shownNotificationIds = useRef<Set<string>>(new Set());
  const isFirstFetch = useRef(true);

  // Request browser notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Show browser notification for new notifications
  const showBrowserNotificationForNew = useCallback(
    (newNotifications: Notification[]) => {
      // Skip on first fetch to avoid showing notifications for existing items
      if (isFirstFetch.current) {
        // Mark all current notifications as "seen" for browser notification purposes
        for (const n of newNotifications) {
          shownNotificationIds.current.add(n.id);
        }
        isFirstFetch.current = false;
        return;
      }

      if (!canShowBrowserNotifications()) return;

      // Find notifications we haven't shown yet
      const unseenNotifications = newNotifications.filter(
        (n) => !n.isRead && !shownNotificationIds.current.has(n.id),
      );

      // Show browser notification for each new unread notification
      for (const notification of unseenNotifications) {
        shownNotificationIds.current.add(notification.id);

        showBrowserNotification(notification.title, {
          body: notification.message,
          tag: notification.id,
          onClick: () => {
            if (notification.actionUrl) {
              router.push(notification.actionUrl);
            }
          },
        });
      }
    },
    [router],
  );

  // Fetch notifications on mount and poll every 30 seconds
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/notifications");
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);

          // Show browser notifications for new items
          showBrowserNotificationForNew(data.notifications);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately if no initial data
    if (initialNotifications.length === 0 && initialUnreadCount === 0) {
      fetchNotifications();
    } else {
      // Mark initial notifications as seen
      for (const n of initialNotifications) {
        shownNotificationIds.current.add(n.id);
      }
      isFirstFetch.current = false;
    }

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [initialNotifications, initialUnreadCount, showBrowserNotificationForNew]);

  const handleCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative opacity-50"
        aria-label="Notificaciones"
        disabled
      >
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${isLoading ? "opacity-50" : ""}`}
          aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
        >
          <Bell className={`h-5 w-5 ${isLoading ? "animate-pulse" : ""}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <NotificationList
          initialNotifications={notifications}
          initialUnreadCount={unreadCount}
          onCountChange={handleCountChange}
          onClose={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
