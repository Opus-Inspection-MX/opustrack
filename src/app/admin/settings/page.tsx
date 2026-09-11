import { PageHeader } from "@/components/common/page-header";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function SettingsPage() {
  await requireRouteAccess("/admin/settings");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Gestionar configuración del sistema y tablas de referencia. Elige una sección en las pestañas de arriba."
      />
    </div>
  );
}
