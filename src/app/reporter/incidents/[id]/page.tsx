import { Building, Calendar, FileText, User } from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { IncidentAttachments } from "@/components/incidents/incident-attachments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getIncidentById } from "@/lib/actions/incidents";
import { canPerform, requireRouteAccess } from "@/lib/auth/auth";
import { isIncidentTerminal } from "@/lib/constants/status-codes";
import { formatIncidentDateTime, formatMX } from "@/lib/utils/datetime";
import { formatReporter } from "@/lib/utils/incident-display";

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

export default async function ReporterIncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/reporter/incidents");

  const { id } = await params;
  const incident = await getIncidentById(Number.parseInt(id, 10));
  // RF-217: REPORTER-role users hold incidents:create (no update).
  const [canCreate, canUpdate] = await Promise.all([
    canPerform("incidents:create"),
    canPerform("incidents:update"),
  ]);
  const terminal = isIncidentTerminal(incident.status);

  return (
    <PageContainer>
      <PageHeader
        title={incident.title}
        description={`Folio: INC-${incident.id}`}
        breadcrumbs={[
          { label: "Mis Incidentes", href: "/reporter" },
          { label: `INC-${incident.id}` },
        ]}
        actions={
          <div className="text-xl">{getStatusBadge(incident.status)}</div>
        }
      />
      <div>
        <BackButton fallback="/reporter" />
      </div>

      {/* Incident Details Card */}
      <SectionCard title="Detalles del Incidente">
        <div className="space-y-6">
          {/* Description */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Descripcion</p>
            <p className="text-base">{incident.description}</p>
          </div>

          <div className="border-t" />

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  {incident.client
                    ? `${incident.client.name} (${incident.client.code})`
                    : "No asignado"}
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
                    incident.client?.state?.code,
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
                      incident.client?.state?.code,
                    )}
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
                    {formatIncidentDateTime(
                      incident.resolvedAt,
                      incident.client?.state?.code,
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {incident.schedule && (
            <>
              <div className="border-t" />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Agenda</p>
                <p className="font-medium">{incident.schedule.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMX(incident.schedule.scheduledAt)}
                </p>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* Evidence photos filed with the report (RF-217) */}
      <IncidentAttachments
        incidentId={incident.id}
        attachments={incident.attachments ?? []}
        canManage={canCreate || canUpdate}
        terminal={terminal}
      />

      {/* Assignments */}
      {incident.assignments && incident.assignments.length > 0 && (
        <SectionCard title={`Asignaciones (${incident.assignments.length})`}>
          <ul className="space-y-3">
            {incident.assignments.map((wo) => (
              <li
                key={wo.id}
                className="flex flex-col gap-3 border rounded-lg p-4 hover:bg-accent/50 transition-colors sm:flex-row sm:items-center sm:justify-between"
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
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full sm:w-auto"
                >
                  <Link href={`/reporter/assignments/${wo.id}`}>
                    Ver Progreso
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Back Button */}
      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link href="/reporter">Volver</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
