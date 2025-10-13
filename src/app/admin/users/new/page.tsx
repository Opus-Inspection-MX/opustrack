import { getUserFormOptions } from "@/lib/actions/users";
import { UserForm } from "@/components/admin/users/user-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewUserPage() {
  const { roles, statuses, vics } = await getUserFormOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Usuario</h1>
          <p className="text-muted-foreground">
            Crear un nuevo usuario en el sistema
          </p>
        </div>
      </div>

      <UserForm roles={roles} statuses={statuses} vics={vics} />
    </div>
  );
}
