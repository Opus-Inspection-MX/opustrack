import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/auth";
import { markAllAsRead } from "@/lib/notifications/notification-service";

export async function POST() {
  try {
    const user = await requirePermission("notifications:update");

    await markAllAsRead(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking all as read:", error);
    return NextResponse.json(
      { error: "Failed to mark all as read" },
      { status: 500 },
    );
  }
}
