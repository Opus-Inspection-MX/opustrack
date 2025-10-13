import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, Wrench, Calendar } from "lucide-react";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function AdminDashboard() {
  const { stats, recentIncidents, pendingWorkOrders } = await getDashboardStats();

  const statCards = [
    {
      title: "Total de Usuarios",
      value: stats.totalUsers.toString(),
      icon: Users,
      description: "Usuarios activos en el sistema",
      color: "text-blue-600",
      href: "/admin/users",
    },
    {
      title: "Incidentes Activos",
      value: stats.activeIncidents.toString(),
      icon: AlertTriangle,
      description: `${stats.criticalIncidents} críticos`,
      color: "text-red-600",
      href: "/admin/incidents",
    },
    {
      title: "Órdenes de Trabajo Abiertas",
      value: stats.openWorkOrders.toString(),
      icon: Wrench,
      description: "Requieren atención",
      color: "text-orange-600",
      href: "/admin/work-orders",
    },
    {
      title: "Tareas Programadas",
      value: stats.scheduledTasks.toString(),
      icon: Calendar,
      description: "Próximas actividades",
      color: "text-green-600",
      href: "/admin/schedules",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Panel de Administración</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Bienvenido al panel de administración de OpusTrack
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
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
                          Reportado por {incident.reportedBy?.name || "Desconocido"} •{" "}
                          {new Date(incident.reportedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant={incident.priority >= 8 ? "destructive" : "secondary"}
                      >
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
            <CardTitle>Órdenes de Trabajo Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingWorkOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay órdenes pendientes
                </p>
              ) : (
                pendingWorkOrders.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/admin/work-orders/${wo.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 px-2 rounded transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {wo.incident.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Asignado a {wo.assignedTo.name}
                        </p>
                      </div>
                      <Badge variant="outline">{wo.status}</Badge>
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
