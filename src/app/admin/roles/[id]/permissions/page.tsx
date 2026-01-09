import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionSelector } from "@/components/admin/roles/permission-selector";
import { Button } from "@/components/ui/button";
import { getAllPermissions, getRoleById } from "@/lib/actions/roles";

export default async function RolePermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [role, allPermissions] = await Promise.all([
    getRoleById(parseInt(id, 10)),
    getAllPermissions(),
  ]);

  if (!role) notFound();

  const currentPermissionIds = role.rolePermission.map(
    (rp) => rp.permission.id,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/roles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Administrar Permisos</h1>
          <p className="text-muted-foreground">
            Asignar permisos al rol: {role.name}
          </p>
        </div>
      </div>

      <PermissionSelector
        roleId={role.id}
        roleName={role.name}
        allPermissions={allPermissions}
        currentPermissionIds={currentPermissionIds}
      />
    </div>
  );
}
