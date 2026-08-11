import { notFound } from "next/navigation";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { getLineStatusById, updateLineStatus } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditLineStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/settings/line-status");

  const { id } = await params;
  const status = await getLineStatusById(Number.parseInt(id, 10));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Editar Estado de Línea</h1>
        <p className="text-muted-foreground">Update line status information</p>
      </div>

      <GenericStatusForm
        initialData={status}
        // Bound, not wrapped: an inline arrow would be a plain closure, and a
        // Server Component cannot pass one to a Client Component.
        onSubmit={updateLineStatus.bind(null, status.id)}
        redirectPath="/admin/settings/line-status"
        title="Line Status Details"
        isEdit
      />
    </div>
  );
}
