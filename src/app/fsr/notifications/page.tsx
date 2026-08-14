import { Bell } from "lucide-react";
import { BackButton } from "@/components/common/back-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getNotificationsWithCount } from "@/lib/actions/notifications";
import { requireRouteAccess } from "@/lib/auth/auth";
import { NotificationsPageClient } from "./notifications-page-client";

export default async function FSRNotificationsPage() {
  await requireRouteAccess("/fsr/notifications");
  const { notifications, unreadCount } = await getNotificationsWithCount({
    limit: 50,
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <BackButton fallback="/fsr" />
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-7 w-7" />
            Mis Notificaciones
          </h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0
              ? `Tienes ${unreadCount} sin leer`
              : "Estás al día"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notificaciones recientes</CardTitle>
          <CardDescription>
            Toca una notificación para abrirla y marcarla como leída
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <NotificationsPageClient
            notifications={notifications}
            unreadCount={unreadCount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
