import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/auth";
import {
  getNotificationSignature,
  getUnreadCount,
  getUserNotifications,
} from "@/lib/notifications/notification-service";
import { logger } from "@/lib/observability/logger";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("notifications:read");

    // Fase 6a: cheap polling signature (`unreadCount` + latest id). The bell
    // polls this every 30 s and only reloads the full list when it moves.
    const { searchParams } = new URL(request.url);
    if (searchParams.get("signature") === "1") {
      const { unreadCount, latestId } = await getNotificationSignature(user.id);
      return NextResponse.json({
        signature: `${unreadCount}:${latestId ?? "none"}`,
      });
    }

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
