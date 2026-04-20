import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Lock,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyWorkOrders } from "@/lib/actions/work-orders";
import { requireRouteAccess } from "@/lib/auth/auth";

interface WorkOrderIncident {
  id: number;
  title: string;
  priority: number;
}

interface WorkOrder {
  id: string;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  unlockedAt?: Date | string | null;
  assignedAt?: Date | string | null;
  incident?: WorkOrderIncident | null;
}

export default async function FSRWorkOrdersPage() {
  await requireRouteAccess("/fsr");
  const workOrders = await getMyWorkOrders();

  // Calculate stats
  const stats = {
    total: workOrders.length,
    pendingUnlock: workOrders.filter((wo) => !wo.unlockedAt && !wo.finishedAt)
      .length,
    notStarted: workOrders.filter(
      (wo) => wo.unlockedAt && !wo.startedAt && !wo.finishedAt,
    ).length,
    inProgress: workOrders.filter((wo) => wo.startedAt && !wo.finishedAt)
      .length,
    completed: workOrders.filter((wo) => wo.finishedAt).length,
  };

  const getStatusBadge = (workOrder: WorkOrder) => {
    if (workOrder.finishedAt) {
      return (
        <Badge variant="default" className="bg-green-600">
          Completada
        </Badge>
      );
    }
    if (workOrder.startedAt) {
      return <Badge variant="secondary">En Progreso</Badge>;
    }
    if (!workOrder.unlockedAt) {
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 border-yellow-300"
        >
          <Lock className="h-3 w-3 mr-1" />
          Pendiente de Desbloqueo
        </Badge>
      );
    }
    return <Badge variant="outline">No Iniciada</Badge>;
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
        <h1 className="text-3xl font-bold">Mis Órdenes de Trabajo</h1>
        <p className="text-muted-foreground mt-2">
          Órdenes de trabajo asignadas a ti
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pend. Desbloqueo
            </CardTitle>
            <Lock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pendingUnlock}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Iniciadas</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.notStarted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Work Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Órdenes de Trabajo ({workOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No tienes órdenes de trabajo asignadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workOrders.map((wo) => (
                <div
                  key={wo.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Status and Priority */}
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
                        {wo.status && (
                          <Badge variant="secondary">{wo.status.name}</Badge>
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
                        {wo.incident?.vic && (
                          <div>
                            <span className="font-medium">VIC:</span>{" "}
                            {wo.incident.vic.name}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Actividades:</span>{" "}
                          {wo._count?.workActivities || 0}
                        </div>
                        <div>
                          <span className="font-medium">Refacciones:</span>{" "}
                          {wo._count?.workParts || 0}
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Creada: {new Date(wo.createdAt).toLocaleDateString("es-MX")}
                        </div>
                        {wo.startedAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Iniciada:{" "}
                            {new Date(wo.startedAt).toLocaleDateString("es-MX")}
                          </div>
                        )}
                        {wo.finishedAt && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completada:{" "}
                            {new Date(wo.finishedAt).toLocaleDateString("es-MX")}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div>
                      <Button
                        asChild
                        className={
                          !wo.unlockedAt && !wo.finishedAt
                            ? "bg-yellow-600 hover:bg-yellow-700"
                            : ""
                        }
                      >
                        <Link href={`/fsr/work-orders/${wo.id}`}>
                          {wo.finishedAt
                            ? "Ver"
                            : !wo.unlockedAt
                              ? "Desbloquear"
                              : "Trabajar"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
