import { IncidentTypeForm } from "@/components/incident-types/incident-type-form";
import { createIncidentType } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewIncidentTypePage() {
  await requireRouteAccess("/admin/incident-types/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Crear Tipo de Incidente</h1>
        <p className="text-muted-foreground">Add a new incident type</p>
      </div>

      <IncidentTypeForm
        // Bound, not wrapped: an inline arrow would be a plain closure, and a
        // Server Component cannot pass one to a Client Component.
        onSubmit={createIncidentType}
        redirectPath="/admin/incident-types"
        title="Incident Type Details"
      />
    </div>
  );
}
