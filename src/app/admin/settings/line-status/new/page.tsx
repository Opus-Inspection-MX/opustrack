import { requireRouteAccess } from "@/lib/auth/auth";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { createLineStatus } from "@/lib/actions/lookups";

export default async function NewLineStatusPage() {
  await requireRouteAccess("/admin/settings/line-status/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Line Status</h1>
        <p className="text-muted-foreground">
          Add a new verification line status type
        </p>
      </div>

      <GenericStatusForm
        onSubmit={createLineStatus}
        redirectPath="/admin/settings/line-status"
        title="Line Status Details"
      />
    </div>
  );
}
