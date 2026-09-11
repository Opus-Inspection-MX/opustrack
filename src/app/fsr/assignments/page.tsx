import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyAssignments } from "@/lib/actions/assignments";
import { requireRouteAccess } from "@/lib/auth/auth";
import { codeOf } from "@/lib/constants/status-codes";
import { ASSIGNMENT_STATE } from "@/lib/state-machine/assignment-machine";
import { formatMX } from "@/lib/utils/datetime";

type AssignmentStatusRef = {
  name: string;
  color?: string | null;
} | null;

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE_DE_ASIGNACION: "Pendiente de asignación",
  ASIGNADO: "Asignada",
  VISTO: "Vista",
  INICIADO: "En sitio",
  EN_PROGRESO: "En progreso",
  CERRADO: "Cerrada",
};

const STATUS_TONE: Record<string, StatusTone> = {
  ASIGNADO: "open",
  VISTO: "info",
  INICIADO: "progress",
  EN_PROGRESO: "progress",
  CERRADO: "done",
};

export default async function FSRAssignmentsPage() {
  await requireRouteAccess("/fsr");
  const assignments = await getMyAssignments();

  // Calculate stats by stable status code (H-08), not derived from dates.
  // STATUS_LABELS/TONE stay keyed by the same strings (codes == labels today).
  const byStatus = (code: string) =>
    assignments.filter((wo) => codeOf(wo.status) === code).length;
  const stats = {
    total: assignments.length,
    pendingSeen: byStatus(ASSIGNMENT_STATE.ASIGNADO),
    notStarted: byStatus(ASSIGNMENT_STATE.VISTO),
    inProgress:
      byStatus(ASSIGNMENT_STATE.INICIADO) +
      byStatus(ASSIGNMENT_STATE.EN_PROGRESO),
    completed: byStatus(ASSIGNMENT_STATE.CERRADO),
  };

  const getStatusBadge = (status: AssignmentStatusRef) => {
    const code = codeOf(status) ?? "";
    const label = STATUS_LABELS[code] ?? status?.name ?? "Sin estado";
    return (
      <StatusBadge tone={STATUS_TONE[code] ?? "neutral"}>{label}</StatusBadge>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Mis Asignaciones"
        description="Asignaciones asignadas a ti"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard title="Total" value={stats.total} icon={Wrench} />
        <StatCard
          title="Por visualizar"
          value={stats.pendingSeen}
          icon={Eye}
          tone="info"
        />
        <StatCard title="No Iniciadas" value={stats.notStarted} icon={Clock} />
        <StatCard
          title="En Progreso"
          value={stats.inProgress}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          title="Completadas"
          value={stats.completed}
          icon={CheckCircle}
          tone="success"
        />
      </div>

      {/* Assignments List */}
      <SectionCard title={`Asignaciones (${assignments.length})`}>
        {assignments.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Sin asignaciones"
            description="No tienes asignaciones asignadas"
          />
        ) : (
          <div className="space-y-4">
            {assignments.map((wo) => (
              <div
                key={wo.id}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(wo.status ?? null)}
                      {wo.incident?.type && (
                        <Badge variant="outline">{wo.incident.type.name}</Badge>
                      )}
                    </div>

                    {/* Incident Title */}
                    <div>
                      <h3 className="font-semibold text-lg">
                        {wo.incident?.title || "Sin incidente"}
                      </h3>
                      {wo.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {wo.notes}
                        </p>
                      )}
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                      {wo.incident?.client && (
                        <div>
                          <span className="font-medium">Cliente:</span>{" "}
                          {wo.incident.client.name}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Actividades:</span>{" "}
                        {wo._count?.assignmentActivities || 0}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Creada: {formatMX(wo.createdAt, { dateStyle: "short" })}
                      </div>
                      {wo.startedAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Iniciada:{" "}
                          {formatMX(wo.startedAt, { dateStyle: "short" })}
                        </div>
                      )}
                      {wo.finishedAt && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Completada:{" "}
                          {formatMX(wo.finishedAt, { dateStyle: "short" })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div>
                    <Button asChild className="min-h-[44px]">
                      <Link href={`/fsr/assignments/${wo.id}`}>
                        {codeOf(wo.status) === ASSIGNMENT_STATE.CERRADO
                          ? "Ver"
                          : codeOf(wo.status) === ASSIGNMENT_STATE.ASIGNADO
                            ? "Marcar visto"
                            : "Trabajar"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
