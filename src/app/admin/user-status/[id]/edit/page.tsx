import { notFound } from "next/navigation";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { getUserStatusById, updateUserStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditUserStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/user-status");

  const { id } = await params;
  const status = await getUserStatusById(Number.parseInt(id, 10));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit User Status</h1>
        <p className="text-muted-foreground">Update user status information</p>
      </div>

      <GenericStatusForm
        initialData={status}
        onSubmit={(data) => updateUserStatus(status.id, data)}
        redirectPath="/admin/user-status"
        title="User Status Details"
        isEdit
      />
    </div>
  );
}
