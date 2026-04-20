import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  Wrench,
} from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getMyNotifications,
  getMyUnreadCount,
} from "@/lib/actions/notifications";
import { getMyWorkOrders } from "@/lib/actions/work-orders";
import { requireRouteAccess } from "@/lib/auth/auth";

moment.locale("es");

interface WorkOrderIncident {
  id: number;
  title: string;
  priority: number;
}

interface WorkOrder {
  id: string;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  incident?: WorkOrderIncident | null;
}

export default async function FSRDashboardPage() {
  await requireRouteAccess("/fsr");
  const [workOrders, unreadNotifications, unreadCount] = await Promise.all([
    getMyWorkOrders(),
    getMyNotifications({ limit: 3, unreadOnly: true }),
    getMyUnreadCount(),
  ]);

  // Calculate stats
  const stats = {
    total: workOrders.length,
    notStarted: workOrders.filter((wo) => !wo.startedAt).length,
    inProgress: workOrders.filter((wo) => wo.startedAt && !wo.finishedAt)
      .length,
    completed: workOrders.filter((wo) => wo.finishedAt).length,
  };

  // Get urgent work orders (high priority and not completed)
  const urgentWorkOrders = workOrders
    .filter((wo) => !wo.finishedAt && (wo.incident?.priority || 0) >= 7)
    .slice(0, 5);

  const getStatusBadge = (workOrder: WorkOrder) => {
    if (workOrder.finishedAt) {
      return (
        <Badge variant="default" className="bg-green-600">
          Completado
        </Badge>
      );
    }
    if (workOrder.startedAt) {
      return <Badge variant="secondary">En Progreso</Badge>;
    }
    return <Badge variant="outline">No Iniciado</Badge>;
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "text-red-600 font-bold";
    if (priority >= 5) return "text-orange-600 font-semibold";
    return "text-blue-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Panel FSR</h1>
        <p className="text-muted-foreground mt-2">
          ¡Bienvenido de nuevo! Aquí está tu resumen de trabajo
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Órdenes de Trabajo Totales
            </CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Asignadas a ti</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Iniciadas</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.notStarted}</div>
            <p className="text-xs text-muted-foreground">Esperando comenzar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">
              Trabajando actualmente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Órdenes terminadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Work Notifications */}
      <Card
        className={
          unreadCount > 0
            ? "border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
            : "border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
        }
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                unreadCount > 0
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
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
            <Link href="/fsr/notifications">Ver mis notificaciones</Link>
          </Button>
        </CardHeader>
        {unreadNotifications.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {unreadNotifications.map((n) => (
                <Link
                  key={n.id}
                  href={`/fsr/notifications?open=${n.id}`}
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

      {/* Urgent Work Orders */}
      {urgentWorkOrders.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Órdenes de Trabajo Urgentes ({urgentWorkOrders.length})
            </CardTitle>
            <CardDescription className="text-red-600 dark:text-red-300">
              Órdenes de trabajo de alta prioridad que requieren atención
              inmediata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {urgentWorkOrders.map((wo) => (
                <div
                  key={wo.id}
                  className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(wo)}
                        <Badge
                          variant="outline"
                          className={getPriorityColor(
                            wo.incident?.priority || 0,
                          )}
                        >
                          Prioridad: {wo.incident?.priority || 0}/10
                        </Badge>
                      </div>
                      <h3 className="font-semibold">
                        {wo.incident?.title || "Sin incidente"}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        {wo.incident?.vic && (
                          <span>CVV: {wo.incident.vic.name}</span>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/fsr/work-orders/${wo.id}`}>Ver</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Work Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Órdenes de Trabajo Recientes</CardTitle>
            <CardDescription>
              Tus órdenes de trabajo asignadas más recientes
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/fsr/work-orders">Ver Todas</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No hay órdenes de trabajo asignadas aún</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workOrders.slice(0, 5).map((wo) => (
                <div
                  key={wo.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(wo)}
                        <Badge
                          variant="outline"
                          className={getPriorityColor(
                            wo.incident?.priority || 0,
                          )}
                        >
                          Prioridad: {wo.incident?.priority || 0}/10
                        </Badge>
                        {wo.incident?.type && (
                          <Badge variant="outline">
                            {wo.incident.type.name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold">
                        {wo.incident?.title || "Sin incidente"}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        {wo.incident?.vic && (
                          <div>
                            <span className="font-medium">CVV:</span>{" "}
                            {wo.incident.vic.name}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Actividades:</span>{" "}
                          {wo._count?.workActivities || 0}
                        </div>
                        <div>
                          <span className="font-medium">Creada:</span>{" "}
                          {new Date(wo.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Button asChild>
                      <Link href={`/fsr/work-orders/${wo.id}`}>
                        {wo.finishedAt ? "Ver" : "Trabajar en Esto"}
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button asChild variant="outline" className="h-auto py-4">
              <Link
                href="/fsr/work-orders"
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
              <Link
                href="/profile"
                className="flex flex-col items-center gap-2"
              >
                <Calendar className="h-6 w-6" />
                <span>Mi Perfil</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
