import { notFound } from "next/navigation";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import {
  getWorkOrderStatusById,
  updateWorkOrderStatus,
} from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditWorkOrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/settings/work-order-status");

  const { id } = await params;
  const status = await getWorkOrderStatusById(Number.parseInt(id, 10));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Work Order Status</h1>
        <p className="text-muted-foreground">
          Update work order status information
        </p>
      </div>

      <GenericStatusForm
        initialData={status}
        onSubmit={(data) => updateWorkOrderStatus(status.id, data)}
        redirectPath="/admin/settings/work-order-status"
        title="Work Order Status Details"
        isEdit
      />
    </div>
  );
}
