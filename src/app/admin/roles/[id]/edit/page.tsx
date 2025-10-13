import { getRoleById } from "@/lib/actions/roles";
import { RoleForm } from "@/components/admin/roles/role-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await getRoleById(parseInt(id));

  if (!role) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/roles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Rol</h1>
          <p className="text-muted-foreground">Modificar {role.name}</p>
        </div>
      </div>

      <RoleForm role={role} />
    </div>
  );
}
