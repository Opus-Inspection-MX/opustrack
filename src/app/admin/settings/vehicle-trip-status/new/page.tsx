import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { createVehicleTripStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewVehicleTripStatusPage() {
  await requireRouteAccess("/admin/settings/vehicle-trip-status/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Crear Estado de Viaje Vehicular</h1>
        <p className="text-muted-foreground">
          Add a new vehicle trip status type
        </p>
      </div>

      <GenericStatusForm
        onSubmit={createVehicleTripStatus}
        redirectPath="/admin/settings/vehicle-trip-status"
        title="Vehicle Trip Status Details"
      />
    </div>
  );
}
