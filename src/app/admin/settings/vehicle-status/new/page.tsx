import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { createVehicleStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewVehicleStatusPage() {
  await requireRouteAccess("/admin/settings/vehicle-status/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Crear Estado de Vehículo</h1>
        <p className="text-muted-foreground">Add a new vehicle status type</p>
      </div>

      <GenericStatusForm
        onSubmit={createVehicleStatus}
        redirectPath="/admin/settings/vehicle-status"
        title="Vehicle Status Details"
      />
    </div>
  );
}
