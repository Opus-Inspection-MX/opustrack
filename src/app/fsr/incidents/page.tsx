import { AlertTriangle, Building2, Calendar, Eye, User } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/incident-types/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyIncidents } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";
import { formatIncidentDateTime } from "@/lib/utils/datetime";
import { formatReporter } from "@/lib/utils/incident-display";

export default async function FSRIncidentsPage() {
  await requireRouteAccess("/fsr");
  const incidents = await getMyIncidents();

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
        title="Mis Incidentes"
        description="Incidentes relacionados con tus asignaciones asignadas"
      />

      <SectionCard
        title={`Incidentes (${incidents.length})`}
        description="Mostrando incidentes que tienen asignaciones asignadas a ti"
      >
        {incidents.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Sin incidentes"
            description="No hay incidentes relacionados con tus asignaciones"
          />
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {incident.status && (
                        <StatusBadge tone={getStatusTone(incident.status.name)}>
                          {incident.status.name}
                        </StatusBadge>
                      )}
                      {incident.type && (
                        <>
                          <Badge variant="outline">{incident.type.name}</Badge>
                          <PriorityBadge priority={incident.type.priority} />
                        </>
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg">
                        {incident.title}
                      </h3>
                      {incident.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {incident.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                      {incident.client && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span>{incident.client.name}</span>
                        </div>
                      )}
                      {(incident.reportedBy || incident.reporterName) && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>
                            {formatReporter(
                              incident.reportedBy?.name,
                              incident.reporterName,
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {formatIncidentDateTime(
                            incident.reportedAt,
                            incident.client?.state?.code,
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {incident._count.assignments} asignación(es)
                    </div>
                  </div>

                  <Button asChild variant="outline" size="sm">
                    <Link href={`/fsr/incidents/${incident.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
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
