import { notFound } from "next/navigation";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import {
  getAssignmentStatusById,
  updateAssignmentStatus,
} from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditAssignmentStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/settings/assignment-status");

  const { id } = await params;
  const status = await getAssignmentStatusById(Number.parseInt(id, 10));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Editar Estado de Asignación</h1>
        <p className="text-muted-foreground">
          Update asignación status information
        </p>
      </div>

      <GenericStatusForm
        initialData={status}
        onSubmit={(data) => updateAssignmentStatus(status.id, data)}
        redirectPath="/admin/settings/assignment-status"
        title="Assignment Status Details"
        isEdit
      />
    </div>
  );
}
