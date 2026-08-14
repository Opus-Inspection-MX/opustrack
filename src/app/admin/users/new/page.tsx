import { UserForm } from "@/components/admin/users/user-form";
import { BackButton } from "@/components/common/back-button";
import { getUserFormOptions } from "@/lib/actions/users";

export default async function NewUserPage() {
  const { roles, statuses, clientes } = await getUserFormOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/users" />
        <div>
          <h1 className="text-3xl font-bold">Nuevo Usuario</h1>
          <p className="text-muted-foreground">
            Crear un nuevo usuario en el sistema
          </p>
        </div>
      </div>

      <UserForm roles={roles} statuses={statuses} clientes={clientes} />
    </div>
  );
}
