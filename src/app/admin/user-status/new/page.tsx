import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { createUserStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewUserStatusPage() {
  await requireRouteAccess("/admin/user-status/new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create User Status</h1>
        <p className="text-muted-foreground">Add a new user status type</p>
      </div>

      <GenericStatusForm
        onSubmit={createUserStatus}
        redirectPath="/admin/user-status"
        title="User Status Details"
      />
    </div>
  );
}
