"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  canShowBrowserNotifications,
  showBrowserNotification,
} from "@/lib/notifications/browser-notifications";
import { logger } from "@/lib/observability/logger";
import {
  LIVE_REFRESH_MAX_BACKOFF_MS,
  useLiveRefresh,
} from "./use-live-refresh";

/** How often to ask "did anything change?" while the tab is in front. */
export const NOTIFICATION_FEED_INTERVAL_MS = 30_000;

export interface FeedNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: Date;
  priority: number;
}

interface UseNotificationFeedOptions {
  initialNotifications?: FeedNotification[];
  initialUnreadCount?: number;
  intervalMs?: number;
  onNavigate?: (url: string) => void;
}

/**
 * The notification bell's data layer (Fase 6a).
 *
 * The bell used to fetch the full 20-notification list every 10 s, even with
 * the tab hidden. This hook polls a cheap signature (`unreadCount` + latest
 * id) every 30 s — visible tab only, never overlapping — and reloads the full
 * list only when the signature moves. Browser notifications for genuinely new
 * unread items are preserved; consecutive signature failures back off
 * exponentially up to 5 minutes.
 */
export function useNotificationFeed({
  initialNotifications = [],
  initialUnreadCount = 0,
  intervalMs = NOTIFICATION_FEED_INTERVAL_MS,
  onNavigate,
}: UseNotificationFeedOptions) {
  const [notifications, setNotifications] =
    useState<FeedNotification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isLoading, setIsLoading] = useState(
    initialNotifications.length === 0 && initialUnreadCount === 0,
  );

  // IDs we already surfaced through the browser Notification API. The first
  // full load after mount only records them; later loads announce the new.
  const shownIds = useRef<Set<string>>(
    new Set(initialNotifications.map((n) => n.id)),
  );
  const skipFirstBroadcast = useRef(true);

  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const broadcastNew = useCallback((fresh: FeedNotification[]) => {
    // The first full load only records: arriving at the screen must not
    // announce what was already there.
    if (skipFirstBroadcast.current) {
      skipFirstBroadcast.current = false;
      for (const notification of fresh) {
        shownIds.current.add(notification.id);
      }
      return;
    }
    if (!canShowBrowserNotifications()) return;
    for (const notification of fresh) {
      if (notification.isRead || shownIds.current.has(notification.id)) {
        continue;
      }
      shownIds.current.add(notification.id);
      const actionUrl = notification.actionUrl;
      showBrowserNotification(notification.title, {
        body: notification.message,
        tag: notification.id,
        onClick: actionUrl
          ? () => onNavigateRef.current?.(actionUrl)
          : undefined,
      });
    }
  }, []);

  const fetchFull = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) {
        logger.error("Failed to fetch notifications: unexpected status");
        return;
      }
      const data = await response.json();
      const fresh = (data.notifications ?? []) as FeedNotification[];
      setNotifications(fresh);
      setUnreadCount(data.unreadCount ?? 0);
      broadcastNew(fresh);
    } catch (error) {
      logger.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [broadcastNew]);

  const fetchSignature = useCallback(async (): Promise<string | null> => {
    const response = await fetch("/api/notifications?signature=1");
    if (!response.ok) {
      throw new Error(`Notification signature failed: ${response.status}`);
    }
    const data = await response.json();
    return typeof data.signature === "string" ? data.signature : null;
  }, []);

  const hasInitialData =
    initialNotifications.length > 0 || initialUnreadCount > 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only initial load
  useEffect(() => {
    if (!hasInitialData) {
      fetchFull();
    }
  }, []);

  useLiveRefresh({
    signature: fetchSignature,
    onChanged: fetchFull,
    intervalMs,
    maxBackoffMs: LIVE_REFRESH_MAX_BACKOFF_MS,
  });

  return { notifications, unreadCount, isLoading, setUnreadCount };
}
