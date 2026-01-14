import { IncidentStatusForm } from "@/components/incident-status/incident-status-form";
import { createIncidentStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewIncidentStatusPage() {
  await requireRouteAccess("/admin/incident-status/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Incident Status</h1>
        <p className="text-muted-foreground">Add a new incident status type</p>
      </div>

      <IncidentStatusForm
        onSubmit={createIncidentStatus}
        redirectPath="/admin/incident-status"
        title="Incident Status Details"
      />
    </div>
  );
}
