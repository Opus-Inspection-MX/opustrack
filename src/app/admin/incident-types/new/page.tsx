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
        onSubmit={async (data) => {
          await createIncidentType(data);
        }}
        redirectPath="/admin/incident-types"
        title="Incident Type Details"
      />
    </div>
  );
}
