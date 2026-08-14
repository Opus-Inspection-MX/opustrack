import { BulkIncidentsClient } from "@/components/admin/incidents/bulk-incidents-client";
import { BackButton } from "@/components/common/back-button";
import { getBulkIncidentCatalogs } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function BulkIncidentsPage() {
  await requireRouteAccess("/admin/incidents");
  const catalogs = await getBulkIncidentCatalogs();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/incidents" />
        <div>
          <h1 className="text-3xl font-bold">Carga masiva de incidentes</h1>
          <p className="text-muted-foreground">
            Selecciona programación, descarga la plantilla, súbela y edita el
            resultado antes de guardar.
          </p>
        </div>
      </div>

      <BulkIncidentsClient catalogs={catalogs} />
    </div>
  );
}
