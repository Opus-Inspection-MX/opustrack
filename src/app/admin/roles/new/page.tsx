import { RoleForm } from "@/components/admin/roles/role-form";
import { BackButton } from "@/components/common/back-button";

export default async function NewRolePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/roles" />
        <div>
          <h1 className="text-3xl font-bold">Nuevo Rol</h1>
          <p className="text-muted-foreground">
            Crear un nuevo rol en el sistema
          </p>
        </div>
      </div>

      <RoleForm />
    </div>
  );
}
