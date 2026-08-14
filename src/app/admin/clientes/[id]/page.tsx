import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Calendar,
  Edit,
  Mail,
  MapPin,
  Package,
  Phone,
  User,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleBadges } from "@/components/users/role-badges";
import { getClienteById } from "@/lib/actions/clientes";
import { requireRouteAccess } from "@/lib/auth/auth";
import { formatIncidentDateTime } from "@/lib/utils/datetime";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/clientes");
  const { id } = await params;
  const cliente = await getClienteById(id);

  if (!cliente) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{cliente.name}</h1>
            <p className="text-muted-foreground">
              Código Cliente: {cliente.code}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/admin/clientes/${id}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Usuarios
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cliente._count.users}</div>
            <p className="text-xs text-muted-foreground">Usuarios asignados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Líneas</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cliente._count.lines}</div>
            <p className="text-xs text-muted-foreground">
              Líneas de inspección
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cliente._count.incidents}</div>
            <p className="text-xs text-muted-foreground">Total de incidentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calendarios</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cliente._count.scheduleClientes}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de calendarios
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cliente Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Nombre del Cliente
                </p>
                <p className="font-medium">{cliente.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Código Cliente</p>
                <p className="font-medium font-mono">{cliente.code}</p>
              </div>
            </div>

            {cliente.companyName && (
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Razón Social</p>
                  <p className="font-medium">{cliente.companyName}</p>
                </div>
              </div>
            )}

            {cliente.rfc && (
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">RFC</p>
                  <p className="font-medium font-mono">{cliente.rfc}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Información de Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cliente.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="font-medium">{cliente.address}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Estado</p>
                <p className="font-medium">{cliente.state.name}</p>
              </div>
            </div>

            {cliente.contact && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Persona de Contacto
                  </p>
                  <p className="font-medium">{cliente.contact}</p>
                </div>
              </div>
            )}

            {cliente.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{cliente.phone}</p>
                </div>
              </div>
            )}

            {cliente.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Correo Electrónico
                  </p>
                  <p className="font-medium">{cliente.email}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assigned Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuarios Asignados ({cliente.users.length})
          </CardTitle>
          <CardDescription>Usuarios asignados a este Cliente</CardDescription>
        </CardHeader>
        <CardContent>
          {cliente.users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay usuarios asignados a este Cliente
            </p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo Electrónico</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cliente.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <RoleBadges userRoles={user.userRoles} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.userStatus.name === "ACTIVO"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {user.userStatus.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/users/${user.id}`}>Ver</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lines and Equipment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Líneas y Equipos ({cliente.lines.length})
          </CardTitle>
          <CardDescription>Líneas de inspección y sus equipos</CardDescription>
        </CardHeader>
        <CardContent>
          {cliente.lines.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay líneas asignadas a este Cliente
            </p>
          ) : (
            <div className="space-y-6">
              {cliente.lines.map((line) => (
                <div key={line.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{line.name}</h3>
                      {line.description && (
                        <p className="text-sm text-muted-foreground">
                          {line.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {line.equipments.length} equipos
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/lines/${line.id}`}>Ver Línea</Link>
                      </Button>
                    </div>
                  </div>

                  {line.equipments.length > 0 ? (
                    <div className="border rounded-lg overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Equipo</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">
                              Acciones
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {line.equipments.map((equipment) => (
                            <TableRow key={equipment.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  {equipment.name}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                {equipment.description || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" asChild>
                                  <Link
                                    href={`/admin/equipments/${equipment.id}/edit`}
                                  >
                                    Ver
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay equipos en esta línea
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Incidents */}
      {cliente.incidents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Incidentes Recientes (Últimos {cliente.incidents.length})
            </CardTitle>
            <CardDescription>
              Incidentes más recientes reportados para este Cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Reportado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cliente.incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="font-mono text-sm">
                        INC-{incident.id}
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate">
                        {incident.title}
                      </TableCell>
                      <TableCell>
                        {incident.type ? (
                          <Badge variant="outline">{incident.type.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {incident.status ? (
                          <Badge variant="secondary">
                            {incident.status.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {/* This page is scoped to one center, so show its own
                            clock (plus CDMX when they differ). */}
                        {formatIncidentDateTime(
                          incident.reportedAt,
                          cliente.state.code,
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/incidents/${incident.id}`}>
                            Ver
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
