import { RoleForm } from "@/components/admin/roles/role-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewRolePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/roles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Rol</h1>
          <p className="text-muted-foreground">Crear un nuevo rol en el sistema</p>
        </div>
      </div>

      <RoleForm />
    </div>
  );
}
