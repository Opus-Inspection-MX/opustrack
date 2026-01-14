import { notFound } from "next/navigation";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import {
  getVehicleTripStatusById,
  updateVehicleTripStatus,
} from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditVehicleTripStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/settings/vehicle-trip-status");

  const { id } = await params;
  const status = await getVehicleTripStatusById(Number.parseInt(id, 10));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Vehicle Trip Status</h1>
        <p className="text-muted-foreground">
          Update vehicle trip status information
        </p>
      </div>

      <GenericStatusForm
        initialData={status}
        onSubmit={(data) => updateVehicleTripStatus(status.id, data)}
        redirectPath="/admin/settings/vehicle-trip-status"
        title="Vehicle Trip Status Details"
        isEdit
      />
    </div>
  );
}
