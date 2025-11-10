import { getVICById } from "@/lib/actions/vics";
import { requireRouteAccess } from "@/lib/auth/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Edit,
  Building,
  MapPin,
  Phone,
  Mail,
  User,
  AlertTriangle,
  Calendar,
  Users,
  Wrench,
  Package
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function VICDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/vic-centers");
  const { id } = await params;
  const vic = await getVICById(id);

  if (!vic) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/vic-centers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{vic.name}</h1>
            <p className="text-muted-foreground">
              Código Cliente: {vic.code}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/admin/vic-centers/${id}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vic._count.users}</div>
            <p className="text-xs text-muted-foreground">Usuarios asignados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Líneas</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vic._count.lines}</div>
            <p className="text-xs text-muted-foreground">Líneas de inspección</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vic._count.incidents}</div>
            <p className="text-xs text-muted-foreground">Total de incidentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calendarios</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vic._count.schedules}</div>
            <p className="text-xs text-muted-foreground">Total de calendarios</p>
          </CardContent>
        </Card>
      </div>

      {/* VIC Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Nombre del Cliente</p>
                <p className="font-medium">{vic.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Código Cliente</p>
                <p className="font-medium font-mono">{vic.code}</p>
              </div>
            </div>

            {vic.companyName && (
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Razón Social</p>
                  <p className="font-medium">{vic.companyName}</p>
                </div>
              </div>
            )}

            {vic.rfc && (
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">RFC</p>
                  <p className="font-medium font-mono">{vic.rfc}</p>
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
            {vic.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="font-medium">{vic.address}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Estado</p>
                <p className="font-medium">{vic.state.name}</p>
              </div>
            </div>

            {vic.contact && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Persona de Contacto</p>
                  <p className="font-medium">{vic.contact}</p>
                </div>
              </div>
            )}

            {vic.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{vic.phone}</p>
                </div>
              </div>
            )}

            {vic.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Correo Electrónico</p>
                  <p className="font-medium">{vic.email}</p>
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
            Usuarios Asignados ({vic.users.length})
          </CardTitle>
          <CardDescription>
            Usuarios asignados a este Cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vic.users.length === 0 ? (
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
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vic.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.userStatus.name === "ACTIVO" ? "default" : "secondary"}
                        >
                          {user.userStatus.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/users/${user.id}`}>
                            Ver
                          </Link>
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
            Líneas y Equipos ({vic.lines.length})
          </CardTitle>
          <CardDescription>
            Líneas de inspección y sus equipos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vic.lines.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay líneas asignadas a este Cliente
            </p>
          ) : (
            <div className="space-y-6">
              {vic.lines.map((line) => (
                <div key={line.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{line.name}</h3>
                      {line.description && (
                        <p className="text-sm text-muted-foreground">{line.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {line.equipments.length} equipos
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/lines/${line.id}`}>
                          Ver Línea
                        </Link>
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
                            <TableHead className="text-right">Acciones</TableHead>
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
                                  <Link href={`/admin/equipments/${equipment.id}/edit`}>
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
      {vic.incidents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Incidentes Recientes (Últimos {vic.incidents.length})
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
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Reportado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vic.incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="font-mono text-sm">
                        #{incident.id}
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
                          <Badge variant="secondary">{incident.status.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={incident.priority >= 7 ? "destructive" : "outline"}
                        >
                          {incident.priority}/10
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(incident.reportedAt).toLocaleDateString()}
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
