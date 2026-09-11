import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ChannelMatrixClient } from "@/components/notifications/channel-matrix-client";
import {
  getChannelMatrix,
  getFailedEmails,
  getSmtpStatus,
} from "@/lib/actions/notification-settings";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NotificationSettingsPage() {
  await requireRouteAccess("/admin/settings/notifications");

  const [matrix, smtp, failed] = await Promise.all([
    getChannelMatrix(),
    getSmtpStatus(),
    getFailedEmails(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Canales de notificación"
        description="Qué eventos llegan por notificación y por correo, y estado del envío de correos"
        breadcrumbs={[
          { label: "Configuración", href: "/admin/settings" },
          { label: "Canales de notificación" },
        ]}
      />
      <div>
        <BackButton fallback="/admin/settings" />
      </div>

      <ChannelMatrixClient
        initialMatrix={matrix}
        initialSmtp={smtp}
        initialFailed={failed}
      />
    </PageContainer>
  );
}
