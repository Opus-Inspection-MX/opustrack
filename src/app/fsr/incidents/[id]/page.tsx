import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  User,
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
import { getIncidentById } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function FSRIncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/fsr");
  const { id } = await params;

  let incident: Awaited<ReturnType<typeof getIncidentById>> | null = null;
  try {
    incident = await getIncidentById(Number.parseInt(id, 10));
  } catch {
    notFound();
  }

  if (!incident) notFound();

  const getStatusColor = (statusName: string | undefined) => {
    switch (statusName) {
      case "ABIERTO":
        return "bg-red-100 text-red-700 border-red-300";
      case "EN_PROGRESO":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "PENDIENTE":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "CERRADO":
        return "bg-green-100 text-green-700 border-green-300";
      default:
        return "";
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "text-red-600 font-bold";
    if (priority >= 5) return "text-orange-600 font-semibold";
    return "text-blue-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/fsr/incidents">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{incident.title}</h1>
          <p className="text-muted-foreground mt-1">Folio: INC-{incident.id}</p>
        </div>
      </div>

      {/* Incident Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            {incident.status && (
              <Badge
                variant="outline"
                className={getStatusColor(incident.status.name)}
              >
                {incident.status.name}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={getPriorityColor(incident.priority)}
            >
              Prioridad: {incident.priority}/10
            </Badge>
            {incident.type && (
              <Badge variant="outline">{incident.type.name}</Badge>
            )}
          </div>
          <CardTitle className="mt-2">Detalles del Incidente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {incident.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">
                Descripcion
              </h4>
              <p>{incident.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {incident.vic && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">CVV:</span>
                <span>{incident.vic.name}</span>
              </div>
            )}
            {incident.reportedBy && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Reportado por:</span>
                <span>{incident.reportedBy.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Fecha:</span>
              <span>{new Date(incident.reportedAt).toLocaleString()}</span>
            </div>
            {incident.sla && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">SLA:</span>
                <span>{incident.sla} horas</span>
              </div>
            )}
            {incident.resolvedAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="font-medium">Resuelto:</span>
                <span>{new Date(incident.resolvedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Asignaciones ({incident.assignments?.length || 0})
          </CardTitle>
          <CardDescription>
            Asignaciones asociadas a este incidente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!incident.assignments || incident.assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No hay asignaciones para este incidente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incident.assignments.map((wo) => (
                <div
                  key={wo.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {wo.status && (
                          <Badge variant="secondary">{wo.status.name}</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          Folio: AS-{wo.folio}
                        </span>
                      </div>
                      {wo.assignees && wo.assignees.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Asignado a:{" "}
                          {wo.assignees.map((a) => a.user.name).join(", ")}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                          Actividades: {wo._count?.assignmentActivities || 0}
                        </span>
                        <span>Partes: {wo._count?.workParts || 0}</span>
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/fsr/assignments/${wo.id}`}>Ver Orden</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
