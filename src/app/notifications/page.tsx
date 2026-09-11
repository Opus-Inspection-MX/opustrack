import { Bell } from "lucide-react";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { SectionCard } from "@/components/common/section-card";
import { getNotificationsWithCount } from "@/lib/actions/notifications";
import { requireRouteAccess } from "@/lib/auth/auth";
import { NotificationsPageClient } from "./notifications-page-client";

export default async function NotificationsPage() {
  await requireRouteAccess("/notifications");
  const { notifications, unreadCount } = await getNotificationsWithCount({
    limit: 50,
  });

  return (
    <PageContainer size="narrow">
      <div className="flex items-center gap-4">
        <BackButton fallback="/" />
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

      <SectionCard
        title="Notificaciones recientes"
        description="Toca una notificación para abrirla y marcarla como leída"
        contentClassName="p-0"
      >
        <NotificationsPageClient
          notifications={notifications}
          unreadCount={unreadCount}
        />
      </SectionCard>
    </PageContainer>
  );
}
