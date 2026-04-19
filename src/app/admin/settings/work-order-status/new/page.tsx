import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { createWorkOrderStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewWorkOrderStatusPage() {
  await requireRouteAccess("/admin/settings/work-order-status/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Work Order Status</h1>
        <p className="text-muted-foreground">
          Add a new work order status type
        </p>
      </div>

      <GenericStatusForm
        onSubmit={createWorkOrderStatus}
        redirectPath="/admin/settings/work-order-status"
        title="Work Order Status Details"
      />
    </div>
  );
}
