import { getUserById, getUserFormOptions } from "@/lib/actions/users";
import { UserForm } from "@/components/admin/users/user-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, { roles, statuses, vics }] = await Promise.all([
    getUserById(id),
    getUserFormOptions(),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Usuario</h1>
          <p className="text-muted-foreground">
            Modificar información de {user.name}
          </p>
        </div>
      </div>

      <UserForm user={user} roles={roles} statuses={statuses} vics={vics} />
    </div>
  );
}
