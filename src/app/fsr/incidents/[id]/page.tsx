import { AlertTriangle, Building2, Calendar, Clock, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/common/back-button";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getIncidentById } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";
import { formatIncidentDateTime } from "@/lib/utils/datetime";
import { formatReporter } from "@/lib/utils/incident-display";

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

  const getStatusTone = (statusName: string | undefined): StatusTone => {
    switch (statusName) {
      case "ABIERTO":
      case "ASIGNADO":
        return "open";
      case "VISTO":
        return "info";
      case "INICIADO":
      case "EN_PROGRESO":
        return "progress";
      case "CERRADO":
        return "done";
      case "CANCELADA":
        return "cancelled";
      default:
        return "neutral";
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={incident.title}
        description={`Folio: INC-${incident.id}`}
        breadcrumbs={[
          { label: "Mis Incidentes", href: "/fsr/incidents" },
          { label: `INC-${incident.id}` },
        ]}
      />
      <div>
        <BackButton fallback="/fsr/incidents" label="Volver" />
      </div>

      {/* Incident Details */}
      <SectionCard
        title="Detalles del Incidente"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {incident.status && (
              <StatusBadge tone={getStatusTone(incident.status.name)}>
                {incident.status.name}
              </StatusBadge>
            )}
            {incident.type && (
              <Badge variant="outline">{incident.type.name}</Badge>
            )}
          </div>
        }
      >
        {incident.description && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Descripcion
            </h4>
            <p>{incident.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {incident.client && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Cliente:</span>
              <span>{incident.client.name}</span>
            </div>
          )}
          {(incident.reportedBy || incident.reporterName) && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Reportado por:</span>
              <span>
                {formatReporter(
                  incident.reportedBy?.name,
                  incident.reporterName,
                )}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Fecha:</span>
            <span>
              {formatIncidentDateTime(
                incident.reportedAt,
                incident.client?.state?.code,
              )}
            </span>
          </div>
          {incident.resolvedAt && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-success-muted-foreground" />
              <span className="font-medium">Resuelto:</span>
              <span>
                {formatIncidentDateTime(
                  incident.resolvedAt,
                  incident.client?.state?.code,
                )}
              </span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Assignments */}
      <SectionCard
        title={`Asignaciones (${incident.assignments?.length || 0})`}
        description="Asignaciones asociadas a este incidente"
      >
        {!incident.assignments || incident.assignments.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Sin asignaciones"
            description="No hay asignaciones para este incidente"
          />
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
                        <StatusBadge tone={getStatusTone(wo.status.name)}>
                          {wo.status.name}
                        </StatusBadge>
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
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/fsr/assignments/${wo.id}`}>
                      Ver Asignación
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
