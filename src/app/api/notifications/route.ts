import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/auth";
import {
  getUnreadCount,
  getUserNotifications,
} from "@/lib/notifications/notification-service";
import { logger } from "@/lib/observability/logger";

export async function GET() {
  try {
    const user = await requirePermission("notifications:read");

    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(user.id, { limit: 20 }),
      getUnreadCount(user.id),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    logger.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}
