import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
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
      <PageHeader
        title="Mis Notificaciones"
        description={
          unreadCount > 0 ? `Tienes ${unreadCount} sin leer` : "Estás al día"
        }
      />
      <div>
        <BackButton fallback="/" />
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
