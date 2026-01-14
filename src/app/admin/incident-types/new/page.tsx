import { requireRouteAccess } from "@/lib/auth/auth";
import { IncidentTypeForm } from "@/components/incident-types/incident-type-form";
import { createIncidentType } from "@/lib/actions/lookups";

export default async function NewIncidentTypePage() {
  await requireRouteAccess("/admin/incident-types/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Incident Type</h1>
        <p className="text-muted-foreground">
          Add a new incident type
        </p>
      </div>

      <IncidentTypeForm
        onSubmit={createIncidentType}
        redirectPath="/admin/incident-types"
        title="Incident Type Details"
      />
    </div>
  );
}
