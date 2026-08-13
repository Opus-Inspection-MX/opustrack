import {
  ArrowLeft,
  Building,
  Calendar,
  Edit as EditIcon,
  FileText,
  Plus,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { CancelIncidentButton } from "@/components/admin/incidents/cancel-incident-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getIncidentById } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";
import { formatIncidentDateTime, formatMX } from "@/lib/utils/datetime";
import { formatReporter } from "@/lib/utils/incident-display";

function getStatusColor(status: string) {
  switch (status) {
    case "CERRADO":
      return "default";
    case "INICIADO":
      return "secondary";
    case "VISTO":
    case "ASIGNADO":
      return "outline";
    default:
      return "outline";
  }
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/incidents");

  const { id } = await params;
  const incident = await getIncidentById(Number.parseInt(id, 10));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/incidents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{incident.title}</h1>
          </div>
          <p className="text-muted-foreground">Folio: INC-{incident.id}</p>
        </div>
        <div className="flex gap-2">
          {incident.status?.name !== "CERRADO" &&
            incident.status?.name !== "CANCELADA" && (
              <>
                <Button variant="outline" asChild>
                  <Link href={`/admin/incidents/${incident.id}/edit`}>
                    <EditIcon className="mr-2 h-4 w-4" />
                    Editar incidencia
                  </Link>
                </Button>
                <CancelIncidentButton incidentId={incident.id} />
              </>
            )}
          <Badge
            variant="secondary"
            className={
              incident.status?.name === "CANCELADA"
                ? "h-9 px-3 bg-red-600 text-white"
                : "h-9 px-3"
            }
          >
            {incident.status?.name || "Sin estado"}
          </Badge>
        </div>
      </div>

      {incident.status?.name === "CANCELADA" && incident.cancellationReason && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-300">
              Incidencia cancelada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">Razón:</span>{" "}
              {incident.cancellationReason}
            </p>
            {incident.cancelledAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Cancelada el {formatMX(incident.cancelledAt)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Incident Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Incidente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Descripción</p>
            <p className="text-base">{incident.description}</p>
          </div>

          <Separator />

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">
                  {incident.type?.name || "Sin tipo"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">
                  {incident.cliente
                    ? `${incident.cliente.name} (${incident.cliente.code})`
                    : "Sin asignar"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Reportado por</p>
                <p className="font-medium">
                  {formatReporter(
                    incident.reportedBy?.name,
                    incident.reporterName,
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Fecha de reporte
                </p>
                <p className="font-medium">
                  {formatIncidentDateTime(
                    incident.reportedAt,
                    incident.cliente?.state?.code,
                  )}
                </p>
              </div>
            </div>

            {incident.startedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Fecha de inicio
                  </p>
                  <p className="font-medium">
                    {formatIncidentDateTime(
                      incident.startedAt,
                      incident.cliente?.state?.code,
                    )}
                  </p>
                </div>
              </div>
            )}

            {incident.resolvedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Fecha de resolución
                  </p>
                  <p className="font-medium">
                    {formatIncidentDateTime(
                      incident.resolvedAt,
                      incident.cliente?.state?.code,
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {incident.schedule && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Programación
                </p>
                <p className="font-medium">{incident.schedule.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMX(incident.schedule.scheduledAt)}
                </p>
              </div>
            </>
          )}

          <Separator />
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              FSRs Habilitados ({incident.assignees?.length || 0})
            </p>
            {incident.assignees && incident.assignees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {incident.assignees.map((a) => (
                  <Badge key={a.user.id} variant="secondary">
                    {a.user.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aún no hay FSRs habilitados. Edita la incidencia para asignar
                FSRs.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Assignments Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              Asignaciones ({incident.assignments?.length || 0})
            </h2>
            <p className="text-sm text-muted-foreground">
              Todas las asignaciones de este incidente
            </p>
          </div>
          <Button asChild>
            <Link href={`/admin/assignments/new?incidentId=${incident.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Asignación
            </Link>
          </Button>
        </div>

        {!incident.assignments || incident.assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                Aún no hay asignaciones
              </p>
              <p className="text-sm mb-4">
                Crea una asignación para comenzar a dar seguimiento a este
                incidente
              </p>
              <Button asChild variant="outline">
                <Link href={`/admin/assignments/new?incidentId=${incident.id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primera asignación
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Asignado a</TableHead>
                    <TableHead>Actividades</TableHead>
                    <TableHead>Partes</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>Finalizado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incident.assignments?.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell>
                        <Badge variant={getStatusColor(wo.status?.name || "")}>
                          {wo.status?.name || "Sin estado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {wo.assignees.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Sin asignar
                            </p>
                          ) : (
                            wo.assignees.map((aa) => (
                              <div key={aa.user.id}>
                                <p className="font-medium">{aa.user.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {aa.user.email}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {wo._count?.assignmentActivities || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {wo._count?.workParts || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatMX(wo.createdAt, { dateStyle: "short" })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {wo.finishedAt
                          ? formatMX(wo.finishedAt, { dateStyle: "short" })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/assignments/${wo.id}`}>
                              Ver
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/assignments/${wo.id}/edit`}>
                              <EditIcon className="mr-2 h-4 w-4" />
                              Editar
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
