import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { createAssignmentStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewAssignmentStatusPage() {
  await requireRouteAccess("/admin/settings/assignment-status/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Crear Estado de Asignación</h1>
        <p className="text-muted-foreground">
          Add a new asignación status type
        </p>
      </div>

      <GenericStatusForm
        onSubmit={createAssignmentStatus}
        redirectPath="/admin/settings/assignment-status"
        title="Assignment Status Details"
      />
    </div>
  );
}
