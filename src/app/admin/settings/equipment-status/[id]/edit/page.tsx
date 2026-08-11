import { notFound } from "next/navigation";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import {
  getEquipmentStatusById,
  updateEquipmentStatus,
} from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditEquipmentStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/settings/equipment-status");

  const { id } = await params;
  const status = await getEquipmentStatusById(Number.parseInt(id, 10));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Editar Estado de Equipo</h1>
        <p className="text-muted-foreground">
          Update equipment status information
        </p>
      </div>

      <GenericStatusForm
        initialData={status}
        // Bound, not wrapped: an inline arrow would be a plain closure, and a
        // Server Component cannot pass one to a Client Component.
        onSubmit={updateEquipmentStatus.bind(null, status.id)}
        redirectPath="/admin/settings/equipment-status"
        title="Equipment Status Details"
        isEdit
      />
    </div>
  );
}
