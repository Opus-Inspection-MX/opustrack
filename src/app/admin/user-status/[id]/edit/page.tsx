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
        <h1 className="text-3xl font-bold">Editar Estado de Usuario</h1>
        <p className="text-muted-foreground">Update user status information</p>
      </div>

      <GenericStatusForm
        initialData={status}
        // Bound, not wrapped: an inline arrow would be a plain closure, and a
        // Server Component cannot pass one to a Client Component.
        onSubmit={updateUserStatus.bind(null, status.id)}
        redirectPath="/admin/user-status"
        title="User Status Details"
        isEdit
      />
    </div>
  );
}
