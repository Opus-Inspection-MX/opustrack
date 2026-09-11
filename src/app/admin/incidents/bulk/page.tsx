import { BulkIncidentsClient } from "@/components/admin/incidents/bulk-incidents-client";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { getBulkIncidentCatalogs } from "@/lib/actions/incidents-bulk";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function BulkIncidentsPage() {
  await requireRouteAccess("/admin/incidents");
  const catalogs = await getBulkIncidentCatalogs();

  return (
    <PageContainer>
      <PageHeader
        title="Carga masiva de incidentes"
        description="Selecciona programación, descarga la plantilla, súbela y edita el resultado antes de guardar."
        breadcrumbs={[
          { label: "Incidentes", href: "/admin/incidents" },
          { label: "Carga masiva" },
        ]}
      />

      <BulkIncidentsClient catalogs={catalogs} />
    </PageContainer>
  );
}
