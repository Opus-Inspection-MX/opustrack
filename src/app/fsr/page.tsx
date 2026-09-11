import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMyAssignments } from "@/lib/actions/assignments";
import {
  getMyNotifications,
  getMyUnreadCount,
} from "@/lib/actions/notifications";
import { requireRouteAccess } from "@/lib/auth/auth";
import { formatMX } from "@/lib/utils/datetime";

moment.locale("es");

interface AssignmentIncident {
  id: number;
  title: string;
}

interface Assignment {
  id: string;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  incident?: AssignmentIncident | null;
}

export default async function FSRDashboardPage() {
  await requireRouteAccess("/fsr");
  const [assignments, unreadNotifications, unreadCount] = await Promise.all([
    getMyAssignments(),
    getMyNotifications({ limit: 3, unreadOnly: true }),
    getMyUnreadCount(),
  ]);

  // Pending asignacións (not completed)
  const urgentAssignments = assignments
    .filter((wo) => !wo.finishedAt)
    .slice(0, 5);

  const getStatusBadge = (assignment: Assignment) => {
    if (assignment.finishedAt) {
      return <StatusBadge tone="done">Completado</StatusBadge>;
    }
    if (assignment.startedAt) {
      return <StatusBadge tone="progress">En Progreso</StatusBadge>;
    }
    return <StatusBadge tone="neutral">No Iniciado</StatusBadge>;
  };

  return (
    <PageContainer>
      <PageHeader
        title="Panel FSR"
        description="Tus conteos viven en Inicio; aquí está tu trabajo pendiente"
      />

      {/* Work Notifications */}
      <Card
        className={
          unreadCount > 0
            ? "border-l-4 border-l-warning bg-warning-muted/50"
            : "border-l-4 border-l-success bg-success-muted/40"
        }
      >
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                unreadCount > 0
                  ? "bg-warning-muted text-warning-muted-foreground"
                  : "bg-success-muted text-success-muted-foreground"
              }`}
            >
              {unreadCount > 0 ? (
                <Bell className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <CardTitle>
                {unreadCount > 0
                  ? `Tienes ${unreadCount} notificación${
                      unreadCount === 1 ? "" : "es"
                    } sin leer`
                  : "Sin notificaciones pendientes"}
              </CardTitle>
              <CardDescription>
                {unreadCount > 0
                  ? "Abre tus notificaciones para ver tu trabajo actual"
                  : "Estás al día con tu trabajo"}
              </CardDescription>
            </div>
          </div>
          <Button asChild variant={unreadCount > 0 ? "default" : "outline"}>
            <Link href="/notifications">Ver mis notificaciones</Link>
          </Button>
        </CardHeader>
        {unreadNotifications.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {unreadNotifications.map((n) => (
                <Link
                  key={n.id}
                  href={`/notifications?open=${n.id}`}
                  className="flex items-start justify-between gap-4 border rounded-lg p-3 bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {moment(n.createdAt).fromNow()}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Urgent Assignments */}
      {urgentAssignments.length > 0 && (
        <Card className="border-danger/40 bg-danger-muted/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-danger-muted-foreground">
              <AlertTriangle className="h-5 w-5" aria-hidden />
              Asignaciones Urgentes ({urgentAssignments.length})
            </CardTitle>
            <CardDescription>
              Asignaciones de alta prioridad que requieren atención inmediata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {urgentAssignments.map((wo) => (
                <div
                  key={wo.id}
                  className="rounded-lg border border-danger/30 bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(wo)}
                      </div>
                      <h3 className="font-semibold">
                        {wo.incident?.title || "Sin incidente"}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        {wo.incident?.client && (
                          <span>Client: {wo.incident.client.name}</span>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/fsr/assignments/${wo.id}`}>Ver</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Assignments */}
      <SectionCard
        title="Asignaciones Recientes"
        description="Tus asignaciones asignadas más recientes"
        actions={
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/fsr/assignments">Ver Todas</Link>
          </Button>
        }
      >
        {assignments.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Sin asignaciones"
            description="No hay asignaciones asignadas aún"
          />
        ) : (
          <div className="space-y-4">
            {assignments.slice(0, 5).map((wo) => (
              <div
                key={wo.id}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(wo)}
                      {wo.incident?.type && (
                        <Badge variant="outline">{wo.incident.type.name}</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold">
                      {wo.incident?.title || "Sin incidente"}
                    </h3>
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
                      <div>
                        <span className="font-medium">Creada:</span>{" "}
                        {formatMX(wo.createdAt, { dateStyle: "short" })}
                      </div>
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={`/fsr/assignments/${wo.id}`}>
                      {wo.finishedAt ? "Ver" : "Trabajar en Esto"}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Quick Actions */}
      <SectionCard title="Acciones Rápidas">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Button asChild variant="outline" className="h-auto py-4">
            <Link
              href="/fsr/assignments"
              className="flex flex-col items-center gap-2"
            >
              <Wrench className="h-6 w-6" />
              <span>Ver Todas las Órdenes</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4">
            <Link
              href="/fsr/incidents"
              className="flex flex-col items-center gap-2"
            >
              <AlertTriangle className="h-6 w-6" />
              <span>Ver Incidentes</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4">
            <Link href="/profile" className="flex flex-col items-center gap-2">
              <Calendar className="h-6 w-6" />
              <span>Mi Perfil</span>
            </Link>
          </Button>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
