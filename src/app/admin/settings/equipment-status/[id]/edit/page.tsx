import { notFound } from "next/navigation";
import { requireRouteAccess } from "@/lib/auth/auth";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { getEquipmentStatusById, updateEquipmentStatus } from "@/lib/actions/lookups";

export default async function EditEquipmentStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/settings/equipment-status");

  const { id } = await params;
  const status = await getEquipmentStatusById(Number.parseInt(id));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Equipment Status</h1>
        <p className="text-muted-foreground">
          Update equipment status information
        </p>
      </div>

      <GenericStatusForm
        initialData={status}
        onSubmit={(data) => updateEquipmentStatus(status.id, data)}
        redirectPath="/admin/settings/equipment-status"
        title="Equipment Status Details"
        isEdit
      />
    </div>
  );
}
