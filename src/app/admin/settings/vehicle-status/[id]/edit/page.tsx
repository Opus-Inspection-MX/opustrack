import { notFound } from "next/navigation";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import {
  getVehicleStatusById,
  updateVehicleStatus,
} from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditVehicleStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/settings/vehicle-status");

  const { id } = await params;
  const status = await getVehicleStatusById(Number.parseInt(id, 10));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Vehicle Status</h1>
        <p className="text-muted-foreground">
          Update vehicle status information
        </p>
      </div>

      <GenericStatusForm
        initialData={status}
        onSubmit={(data) => updateVehicleStatus(status.id, data)}
        redirectPath="/admin/settings/vehicle-status"
        title="Vehicle Status Details"
        isEdit
      />
    </div>
  );
}
