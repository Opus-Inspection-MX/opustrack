import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/auth";
import {
  deleteNotification,
  getNotificationById,
  markAsRead,
} from "@/lib/notifications/notification-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission("notifications:read");

    const { id } = await params;
    const notification = await getNotificationById(id, user.id);

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Error fetching notification:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission("notifications:update");

    const { id } = await params;
    const body = await request.json();

    if (body.isRead === true) {
      const notification = await markAsRead(id, user.id);
      return NextResponse.json(notification);
    }

    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
  } catch (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission("notifications:delete");

    const { id } = await params;
    await deleteNotification(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}
