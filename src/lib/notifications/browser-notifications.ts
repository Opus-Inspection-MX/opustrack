/**
 * Browser Notifications API utility
 * Handles system-level notifications with graceful fallback
 */

export type NotificationPermission = "granted" | "denied" | "default";

/**
 * Check if browser notifications are supported
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission as NotificationPermission;
}

/**
 * Request notification permission from the user
 * Returns the permission status after request
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";

  // Already granted or denied
  if (Notification.permission !== "default") {
    return Notification.permission as NotificationPermission;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermission;
  } catch {
    // Fallback for older browsers that don't support promise-based API
    return new Promise((resolve) => {
      Notification.requestPermission((permission) => {
        resolve(permission as NotificationPermission);
      });
    });
  }
}

/**
 * Show a browser system notification
 * Returns true if notification was shown, false otherwise
 */
export function showBrowserNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    data?: unknown;
    onClick?: () => void;
  },
): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;

  try {
    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || "/icon-192x192.png",
      tag: options?.tag,
      data: options?.data,
      badge: "/icon-192x192.png",
    });

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    return true;
  } catch (error) {
    console.error("Failed to show browser notification:", error);
    return false;
  }
}

/**
 * Check if we should show browser notifications
 * (supported and permission granted)
 */
export function canShowBrowserNotifications(): boolean {
  return isNotificationSupported() && Notification.permission === "granted";
}
