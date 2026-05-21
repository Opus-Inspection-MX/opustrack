import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Calendar,
  FileText,
  User,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getIncidentById } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";

function getPriorityBadge(priority: number) {
  if (priority >= 8) {
    return (
      <Badge variant="destructive" className="text-lg py-2 px-4">
        Critica
      </Badge>
    );
  }
  if (priority >= 5) {
    return (
      <Badge variant="default" className="bg-orange-500 text-lg py-2 px-4">
        Alta
      </Badge>
    );
  }
  if (priority >= 3) {
    return (
      <Badge variant="secondary" className="text-lg py-2 px-4">
        Media
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-lg py-2 px-4">
      Baja
    </Badge>
  );
}

function getStatusBadge(
  status: { name: string; color?: string | null } | null,
) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-lg py-2 px-4">
        Desconocido
      </Badge>
    );
  }

  return (
    <Badge
      className="text-lg py-2 px-4 text-white"
      style={{ backgroundColor: status.color || "#6B7280" }}
    >
      {status.name}
    </Badge>
  );
}

export default async function ClientIncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/client/incidents");

  const { id } = await params;
  const incident = await getIncidentById(Number.parseInt(id, 10));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/client">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{incident.title}</h1>
            {incident.priority >= 8 && (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <p className="text-muted-foreground">Folio: INC-{incident.id}</p>
        </div>
        <div className="flex gap-3">
          <div className="text-xl">{getPriorityBadge(incident.priority)}</div>
          <div className="text-xl">{getStatusBadge(incident.status)}</div>
        </div>
      </div>

      {/* Incident Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Incidente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Descripcion</p>
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
              <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Prioridad</p>
                <p className="font-medium">{incident.priority}/10</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">SLA</p>
                <p className="font-medium">
                  {incident.type?.sla != null
                    ? `${incident.type.sla} horas`
                    : "Sin SLA"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">CVV</p>
                <p className="font-medium">
                  {incident.vic
                    ? `${incident.vic.name} (${incident.vic.code})`
                    : "No asignado"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Reportado por</p>
                <p className="font-medium">
                  {incident.reportedBy?.name || "Desconocido"}
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
                  {new Date(incident.reportedAt).toLocaleString()}
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
                    {new Date(incident.startedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {incident.resolvedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Resuelto el</p>
                  <p className="font-medium">
                    {new Date(incident.resolvedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {incident.schedule && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Agenda</p>
                <p className="font-medium">{incident.schedule.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(incident.schedule.scheduledAt).toLocaleString()}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Assignments */}
      {incident.assignments && incident.assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Asignaciones ({incident.assignments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {incident.assignments.map((wo) => (
                <div
                  key={wo.id}
                  className="flex items-center justify-between border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {wo.status && (
                      <Badge
                        className="text-white"
                        style={{
                          backgroundColor: wo.status.color || "#6B7280",
                        }}
                      >
                        {wo.status.name}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      Orden #{wo.id.slice(0, 8)}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/client/assignments/${wo.id}`}>
                      Ver Progreso
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back Button */}
      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link href="/client">Volver</Link>
        </Button>
      </div>
    </div>
  );
}
