import { notFound } from "next/navigation";
import { requireRouteAccess } from "@/lib/auth/auth";
import { IncidentTypeForm } from "@/components/incident-types/incident-type-form";
import { getIncidentTypeById, updateIncidentType } from "@/lib/actions/lookups";

export default async function EditIncidentTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/incident-types");

  const { id } = await params;
  const incidentType = await getIncidentTypeById(Number.parseInt(id));

  if (!incidentType) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Incident Type</h1>
        <p className="text-muted-foreground">
          Update incident type information
        </p>
      </div>

      <IncidentTypeForm
        initialData={incidentType}
        onSubmit={(data) => updateIncidentType(incidentType.id, data)}
        redirectPath="/admin/incident-types"
        title="Incident Type Details"
        isEdit
      />
    </div>
  );
}
