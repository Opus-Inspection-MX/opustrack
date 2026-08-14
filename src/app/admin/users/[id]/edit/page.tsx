import { notFound } from "next/navigation";
import { UserForm } from "@/components/admin/users/user-form";
import { BackButton } from "@/components/common/back-button";
import { getUserById, getUserFormOptions } from "@/lib/actions/users";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, { roles, statuses, clientes }] = await Promise.all([
    getUserById(id),
    getUserFormOptions(),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/users" />
        <div>
          <h1 className="text-3xl font-bold">Editar Usuario</h1>
          <p className="text-muted-foreground">
            Modificar información de {user.name}
          </p>
        </div>
      </div>

      <UserForm
        user={user}
        roles={roles}
        statuses={statuses}
        clientes={clientes}
      />
    </div>
  );
}
