import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { createEquipmentStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewEquipmentStatusPage() {
  await requireRouteAccess("/admin/settings/equipment-status/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Equipment Status</h1>
        <p className="text-muted-foreground">Add a new equipment status type</p>
      </div>

      <GenericStatusForm
        onSubmit={createEquipmentStatus}
        redirectPath="/admin/settings/equipment-status"
        title="Equipment Status Details"
      />
    </div>
  );
}
