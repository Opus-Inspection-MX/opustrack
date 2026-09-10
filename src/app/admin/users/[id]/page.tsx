import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/common/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserById } from "@/lib/actions/users";
import { requireRouteAccess } from "@/lib/auth/auth";
import { formatMX } from "@/lib/utils/datetime";

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

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/users");
  const { id } = await params;

  const user = await getUserById(id);
  if (!user) notFound();

  const roles = user.userRoles.map((ur) => ur.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallback="/admin/users" label="Volver" />
          <div>
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/admin/users/${user.id}/edit`}>Editar usuario</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cuenta</CardTitle>
            <CardDescription>Acceso y estado del usuario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row label="Nombre">{user.name}</Row>
            <Row label="Correo">{user.email}</Row>
            <Row label="Roles">
              <span className="flex flex-wrap gap-1">
                {roles.length === 0 && (
                  <span className="text-muted-foreground">Sin roles</span>
                )}
                {roles.map((role) => (
                  <Badge key={role.id} variant="secondary">
                    {role.name}
                  </Badge>
                ))}
              </span>
            </Row>
            <Row label="Estado">
              <Badge variant={user.active ? "default" : "destructive"}>
                {user.userStatus?.name ?? (user.active ? "Activo" : "Inactivo")}
              </Badge>
            </Row>
            {user.cliente && (
              <Row label="Cliente">
                {user.cliente.name} ({user.cliente.code})
              </Row>
            )}
            {user.hireDate && (
              <Row label="Contratación">
                {formatMX(user.hireDate, { dateStyle: "medium" })}
              </Row>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perfil y sistema</CardTitle>
            <CardDescription>Contacto y marcas de tiempo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row label="Teléfono">{user.userProfile?.telephone ?? "—"}</Row>
            <Row label="Teléfono secundario">
              {user.userProfile?.secondaryTelephone ?? "—"}
            </Row>
            <Row label="Contacto de emergencia">
              {user.userProfile?.emergencyContact ?? "—"}
            </Row>
            <Row label="Puesto">{user.userProfile?.jobPosition ?? "—"}</Row>
            <Row label="Creado">
              {formatMX(user.createdAt, { dateStyle: "medium" })}
            </Row>
            <Row label="Actualizado">
              {formatMX(user.updatedAt, { dateStyle: "medium" })}
            </Row>
            <Row label="ID">
              <span className="font-mono text-sm">{user.id}</span>
            </Row>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
