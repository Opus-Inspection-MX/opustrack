import { IncidentStatusForm } from "@/components/incident-status/incident-status-form";
import { createIncidentStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewIncidentStatusPage() {
  await requireRouteAccess("/admin/incident-status/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Crear Estado de Incidente</h1>
        <p className="text-muted-foreground">Add a new incident status type</p>
      </div>

      <IncidentStatusForm
        // Bound, not wrapped: an inline arrow would be a plain closure, and a
        // Server Component cannot pass one to a Client Component.
        onSubmit={createIncidentStatus}
        redirectPath="/admin/incident-status"
        title="Incident Status Details"
      />
    </div>
  );
}
