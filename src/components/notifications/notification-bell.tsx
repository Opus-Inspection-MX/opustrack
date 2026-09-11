"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationFeed } from "@/hooks/use-notification-feed";
import { requestNotificationPermission } from "@/lib/notifications/browser-notifications";
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
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Polling lives in the feed hook (Fase 6a): a cheap signature every 30 s,
  // visible tab only, full list only when the signature moves.
  const handleNavigate = useCallback(
    (url: string) => router.push(url),
    [router],
  );
  const { notifications, unreadCount, isLoading, setUnreadCount } =
    useNotificationFeed({
      initialNotifications,
      initialUnreadCount,
      onNavigate: handleNavigate,
    });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Request browser notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const handleCountChange = useCallback(
    (count: number) => {
      setUnreadCount(count);
    },
    [setUnreadCount],
  );

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
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-xs text-destructive-foreground flex items-center justify-center font-medium">
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
