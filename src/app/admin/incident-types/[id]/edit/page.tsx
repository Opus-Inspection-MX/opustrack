import { notFound } from "next/navigation";
import { IncidentTypeForm } from "@/components/incident-types/incident-type-form";
import { getIncidentTypeById, updateIncidentType } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditIncidentTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/incident-types");

  const { id } = await params;
  const incidentType = await getIncidentTypeById(Number.parseInt(id, 10));

  if (!incidentType) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Editar Tipo de Incidente</h1>
        <p className="text-muted-foreground">
          Update incident type information
        </p>
      </div>

      <IncidentTypeForm
        initialData={{
          ...incidentType,
          description: incidentType.description ?? undefined,
        }}
        // Bound, not wrapped: an inline arrow would be a plain closure, and a
        // Server Component cannot pass one to a Client Component.
        onSubmit={updateIncidentType.bind(null, incidentType.id)}
        redirectPath="/admin/incident-types"
        title="Incident Type Details"
        isEdit
      />
    </div>
  );
}
