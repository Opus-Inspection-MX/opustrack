import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { formatIncidentDateTime } from "@/lib/utils/datetime";
import { formatReporter } from "@/lib/utils/incident-display";

export default async function AdminDashboard() {
  // KPIs live on /inicio now (ops-kpis widget): this page keeps the work
  // lists — recent incidents and the pending assignment queue.
  const { recentIncidents, pendingAssignments } = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          Panel de Administración
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Bienvenido al panel de administración de OpusTrack ·{" "}
          <Link href="/inicio" className="text-primary hover:underline">
            ver indicadores en Inicio
          </Link>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incidentes Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentIncidents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay incidentes recientes
                </p>
              ) : (
                recentIncidents.map((incident) => (
                  <Link
                    key={incident.id}
                    href={`/admin/incidents/${incident.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 px-2 rounded transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{incident.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Reportado por{" "}
                          {formatReporter(
                            incident.reportedBy?.name,
                            incident.reporterName,
                          )}{" "}
                          •{" "}
                          {formatIncidentDateTime(
                            incident.reportedAt,
                            incident.client?.state?.code,
                          )}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {incident.status?.name || "Sin estado"}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asignaciones Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay órdenes pendientes
                </p>
              ) : (
                pendingAssignments.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/admin/assignments/${wo.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 px-2 rounded transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {wo.incident.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Asignado a{" "}
                          {wo.assignees.map((a) => a.user.name).join(", ") ||
                            "—"}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {wo.status?.name || "N/A"}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
