"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  Bell,
  CheckCircle,
  ClipboardList,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void>;
  onClose: () => void;
}

const typeIcons: Record<string, React.ElementType> = {
  work_order_assigned: ClipboardList,
  work_order_updated: ClipboardList,
  work_order_completed: CheckCircle,
  incident_created: AlertCircle,
  incident_updated: AlertCircle,
  incident_closed: CheckCircle,
  system: Info,
  announcement: Bell,
};

const priorityColors: Record<number, string> = {
  1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  2: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  3: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function NotificationItem({
  notification,
  onMarkAsRead,
  onClose,
}: NotificationItemProps) {
  const router = useRouter();
  const Icon = typeIcons[notification.type] || Bell;

  const handleClick = async () => {
    // Mark as read if not already
    if (!notification.isRead) {
      await onMarkAsRead(notification.id);
    }

    // Navigate to action URL if present
    if (notification.actionUrl) {
      onClose();
      router.push(notification.actionUrl);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full p-4 text-left hover:bg-muted/50 transition-colors",
        !notification.isRead && "bg-muted/30",
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
            priorityColors[notification.priority] || priorityColors[1],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-sm font-medium truncate",
                !notification.isRead && "font-semibold",
              )}
            >
              {notification.title}
            </p>
            {!notification.isRead && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
              locale: es,
            })}
          </p>
        </div>
      </div>
    </button>
  );
}
