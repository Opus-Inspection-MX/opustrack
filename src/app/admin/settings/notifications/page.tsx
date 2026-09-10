import { BellRing } from "lucide-react";
import { BackButton } from "@/components/common/back-button";
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/settings" />
        <div className="flex items-center gap-3">
          <BellRing className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Canales de notificación</h1>
            <p className="text-muted-foreground">
              Qué eventos llegan por notificación y por correo, y estado del
              envío de correos
            </p>
          </div>
        </div>
      </div>

      <ChannelMatrixClient
        initialMatrix={matrix}
        initialSmtp={smtp}
        initialFailed={failed}
      />
    </div>
  );
}
