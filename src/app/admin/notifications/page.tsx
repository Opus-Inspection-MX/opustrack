import { BackButton } from "@/components/common/back-button";
import { BroadcastManager } from "@/components/notifications/broadcast-manager";
import {
  getMyBroadcastTargets,
  listBroadcasts,
} from "@/lib/actions/broadcasts";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NotificationsPage() {
  await requireRouteAccess("/admin/notifications");

  const [targets, rows] = await Promise.all([
    getMyBroadcastTargets(),
    listBroadcasts(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin" />
        <div>
          <h1 className="text-3xl font-bold">Difusiones</h1>
          <p className="text-muted-foreground">
            Enviar avisos a varios roles, ahora o programados
          </p>
        </div>
      </div>

      <BroadcastManager
        initialRows={rows}
        allowedRoles={targets.roles}
        canTargetAll={targets.canTargetAll}
      />
    </div>
  );
}
