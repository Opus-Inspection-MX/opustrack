import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/common/back-button";
import { BroadcastTargetsForm } from "@/components/roles/broadcast-targets-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRoleBroadcastTargets } from "@/lib/actions/broadcasts";
import { getRoleById, getRolesForSelect } from "@/lib/actions/roles";
import { getAuthenticatedUser, requireRouteAccess } from "@/lib/auth/auth";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="text-base mt-0.5">{children}</div>
    </div>
  );
}

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/roles");
  const { id } = await params;

  const role = await getRoleById(Number.parseInt(id, 10));
  if (!role) notFound();

  const permissions = role.rolePermission.map((rp) => rp.permission);

  // "Puede difundir a" is ROOT-only (granting reach is granting power).
  // The form action re-checks with `assertCanManageRoles`, so hiding it
  // here is UX, not the gate.
  const me = await getAuthenticatedUser();
  const showBroadcastTargets = me?.isSuperuser === true;
  const [broadcastTargets, allRoles] = showBroadcastTargets
    ? await Promise.all([getRoleBroadcastTargets(role.id), getRolesForSelect()])
    : [{ targetIds: [] }, []];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallback="/admin/roles" label="Volver" />
          <div>
            <h1 className="text-3xl font-bold">{role.name}</h1>
            <p className="text-muted-foreground">
              {role.description ?? "Sin descripción"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/roles/${role.id}/permissions`}>
              Gestionar permisos
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/roles/${role.id}/edit`}>Editar rol</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información del rol</CardTitle>
            <CardDescription>Datos básicos y uso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row label="Nombre">{role.name}</Row>
            <Row label="Ruta predeterminada">
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {role.defaultPath}
              </code>
            </Row>
            <Row label="Estado">
              <Badge variant={role.active ? "default" : "destructive"}>
                {role.active ? "Activo" : "Inactivo"}
              </Badge>
            </Row>
            <Row label="Usuarios con este rol">{role._count.userRoles}</Row>
            <Row label="Permisos asignados">{permissions.length}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permisos</CardTitle>
            <CardDescription>
              Lo que este rol puede hacer en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {permissions.length === 0 ? (
              <p className="text-muted-foreground">Sin permisos asignados.</p>
            ) : (
              <ul className="flex flex-wrap gap-1">
                {permissions.map((permission) => (
                  <li key={permission.id}>
                    <Badge
                      variant="secondary"
                      title={permission.description ?? undefined}
                    >
                      {permission.name}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {showBroadcastTargets && (
        <BroadcastTargetsForm
          roleId={role.id}
          roleName={role.name}
          allRoles={allRoles}
          initialTargetIds={broadcastTargets.targetIds}
        />
      )}
    </div>
  );
}
