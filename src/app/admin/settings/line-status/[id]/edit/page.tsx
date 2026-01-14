import { notFound } from "next/navigation";
import { requireRouteAccess } from "@/lib/auth/auth";
import { GenericStatusForm } from "@/components/settings/generic-status-form";
import { getLineStatusById, updateLineStatus } from "@/lib/actions/lookups";

export default async function EditLineStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/settings/line-status");

  const { id } = await params;
  const status = await getLineStatusById(Number.parseInt(id));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Line Status</h1>
        <p className="text-muted-foreground">
          Update line status information
        </p>
      </div>

      <GenericStatusForm
        initialData={status}
        onSubmit={(data) => updateLineStatus(status.id, data)}
        redirectPath="/admin/settings/line-status"
        title="Line Status Details"
        isEdit
      />
    </div>
  );
}
