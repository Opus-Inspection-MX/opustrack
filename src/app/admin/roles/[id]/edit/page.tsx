import { notFound } from "next/navigation";
import { RoleForm } from "@/components/admin/roles/role-form";
import { BackButton } from "@/components/common/back-button";
import { getRoleById } from "@/lib/actions/roles";

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await getRoleById(parseInt(id, 10));

  if (!role) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/roles" />
        <div>
          <h1 className="text-3xl font-bold">Editar Rol</h1>
          <p className="text-muted-foreground">Modificar {role.name}</p>
        </div>
      </div>

      <RoleForm role={role} />
    </div>
  );
}
