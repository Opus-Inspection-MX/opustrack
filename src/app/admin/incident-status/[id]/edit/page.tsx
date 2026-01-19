import { notFound } from "next/navigation";
import { IncidentStatusForm } from "@/components/incident-status/incident-status-form";
import {
  getIncidentStatusById,
  updateIncidentStatus,
} from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditIncidentStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/incident-status");

  const { id } = await params;
  const incidentStatus = await getIncidentStatusById(Number.parseInt(id, 10));

  if (!incidentStatus) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Incident Status</h1>
        <p className="text-muted-foreground">
          Update incident status information
        </p>
      </div>

      <IncidentStatusForm
        initialData={incidentStatus}
        onSubmit={async (data) => {
          await updateIncidentStatus(incidentStatus.id, data);
        }}
        redirectPath="/admin/incident-status"
        title="Incident Status Details"
        isEdit
      />
    </div>
  );
}
