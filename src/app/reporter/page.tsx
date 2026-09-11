import {
  AlertTriangle,
  Building,
  CheckCircle,
  Clock,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { PriorityBadge } from "@/components/incident-types/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getReporterIncidents } from "@/lib/actions/incidents";
import { getMyProfile } from "@/lib/actions/users";
import { requireRouteAccess } from "@/lib/auth/auth";
import { codeOf, INCIDENT_STATE } from "@/lib/constants/status-codes";
import { formatIncidentDateTime } from "@/lib/utils/datetime";

interface IncidentStatus {
  id: number;
  name: string;
  color?: string | null;
}

export default async function ReporterDashboard() {
  await requireRouteAccess("/reporter");
  const incidents = await getReporterIncidents();
  const user = await getMyProfile();

  // Calculate stats — resolved by stable code (H-08).
  const stats = {
    open: incidents.filter((i) => codeOf(i.status) === INCIDENT_STATE.ABIERTO)
      .length,
    inProgress: incidents.filter((i) =>
      (
        [
          INCIDENT_STATE.ASIGNADO,
          INCIDENT_STATE.VISTO,
          INCIDENT_STATE.INICIADO,
        ] as readonly string[]
      ).includes(codeOf(i.status) ?? ""),
    ).length,
    closed: incidents.filter((i) => codeOf(i.status) === INCIDENT_STATE.CERRADO)
      .length,
    total: incidents.length,
  };

  const getStatusBadge = (status: IncidentStatus | null | undefined) => {
    if (!status) {
      return <Badge variant="outline">Desconocido</Badge>;
    }

    return (
      <Badge
        className="text-white"
        style={{ backgroundColor: status.color || "#6B7280" }}
      >
        {status.name}
      </Badge>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Mis Incidentes"
        description="Rastrea y reporta incidentes para tu Cliente"
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/reporter/new">
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Reportar Incidente
            </Link>
          </Button>
        }
      />

      {/* Cliente Info */}
      {user?.client && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm text-muted-foreground">Tu Cliente</p>
                <p className="font-medium">
                  {user.client.name} ({user.client.code})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Incidentes Totales"
          value={stats.total}
          description="Histórico"
          icon={AlertTriangle}
        />
        <StatCard
          title="Abiertos"
          value={stats.open}
          description="Esperando respuesta"
          icon={AlertTriangle}
          tone="info"
        />
        <StatCard
          title="En Progreso"
          value={stats.inProgress}
          description="Resolviéndose"
          icon={Clock}
          tone="warning"
        />
        <StatCard
          title="Resueltos"
          value={stats.closed}
          description="Completados"
          icon={CheckCircle}
          tone="success"
        />
      </div>

      {/* Incidents List */}
      <SectionCard
        title="Incidentes Recientes"
        description="Tus incidentes reportados y su estado"
      >
        {incidents.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Sin incidentes"
            description="No hay incidentes reportados aún"
            action={{
              label: "Reporta tu Primer Incidente",
              href: "/reporter/new",
            }}
          />
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="space-y-2 flex-1">
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-muted-foreground">
                      INC-{incident.id}
                    </span>
                    {getStatusBadge(incident.status)}
                    {incident.type && (
                      <>
                        <Badge variant="outline">{incident.type.name}</Badge>
                        <PriorityBadge priority={incident.type.priority} />
                      </>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-lg">{incident.title}</h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {incident.description}
                  </p>

                  {/* Details */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Reportado:{" "}
                      {formatIncidentDateTime(
                        incident.reportedAt,
                        incident.client?.state?.code,
                      )}
                    </span>
                    {incident._count?.assignments &&
                      incident._count.assignments > 0 && (
                        <span>Asignaciones: {incident._count.assignments}</span>
                      )}
                  </div>
                </div>

                {/* Action Button */}
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/reporter/incidents/${incident.id}`}>
                    Ver Detalles
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Quick Actions */}
      <SectionCard title="Acciones Rápidas">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            asChild
            variant="outline"
            className="h-auto py-4 min-h-[44px]"
          >
            <Link
              href="/reporter/new"
              className="flex flex-col items-center gap-2"
            >
              <Plus className="h-6 w-6" aria-hidden />
              <span>Reportar Nuevo Incidente</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-auto py-4 min-h-[44px]"
          >
            <Link href="/profile" className="flex flex-col items-center gap-2">
              <Building className="h-6 w-6" aria-hidden />
              <span>Mi Perfil</span>
            </Link>
          </Button>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
