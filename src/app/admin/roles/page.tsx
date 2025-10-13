import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getRoles } from "@/lib/actions/roles";
import { RolesTable } from "@/components/admin/roles/roles-table";

export default async function RolesPage() {
  const roles = await getRoles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground">
            Administre los roles del sistema y sus permisos
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/roles/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Rol
          </Link>
        </Button>
      </div>

      <RolesTable roles={roles} />
    </div>
  );
}
