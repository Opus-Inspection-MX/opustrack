import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyAssignments } from "@/lib/actions/assignments";
import { requireRouteAccess } from "@/lib/auth/auth";

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

const STATUS_BADGE_CLASS: Record<string, string> = {
  ASIGNADO: "bg-cyan-50 text-cyan-700 border-cyan-300",
  VISTO: "bg-cyan-100 text-cyan-800 border-cyan-400",
  INICIADO: "bg-blue-100 text-blue-800 border-blue-400",
  EN_PROGRESO: "bg-amber-100 text-amber-800 border-amber-400",
  CERRADO: "bg-green-600 text-white",
};

export default async function FSRAssignmentsPage() {
  await requireRouteAccess("/fsr");
  const assignments = await getMyAssignments();

  // Calculate stats by actual status name (from DB), not derived from dates.
  const byStatus = (name: string) =>
    assignments.filter((wo) => wo.status?.name === name).length;
  const stats = {
    total: assignments.length,
    pendingSeen: byStatus("ASIGNADO"),
    notStarted: byStatus("VISTO"),
    inProgress: byStatus("INICIADO") + byStatus("EN_PROGRESO"),
    completed: byStatus("CERRADO"),
  };

  const getStatusBadge = (status: AssignmentStatusRef) => {
    const name = status?.name ?? "";
    const label = STATUS_LABELS[name] ?? name ?? "Sin estado";
    const cls = STATUS_BADGE_CLASS[name] ?? "";
    if (name === "CERRADO") {
      return <Badge className="bg-green-600 text-white">{label}</Badge>;
    }
    return (
      <Badge variant="outline" className={cls}>
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Mis Asignaciones</h1>
        <p className="text-muted-foreground mt-2">
          Asignaciones asignadas a ti
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
              Por visualizar
            </CardTitle>
            <Eye className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">
              {stats.pendingSeen}
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

      {/* Assignments List */}
      <Card>
        <CardHeader>
          <CardTitle>Asignaciones ({assignments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No tienes asignaciones asignadas</p>
            </div>
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
                          <Badge variant="outline">
                            {wo.incident.type.name}
                          </Badge>
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
                        {wo.incident?.cliente && (
                          <div>
                            <span className="font-medium">Cliente:</span>{" "}
                            {wo.incident.cliente.name}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Actividades:</span>{" "}
                          {wo._count?.assignmentActivities || 0}
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
                          Creada:{" "}
                          {new Date(wo.createdAt).toLocaleDateString("es-MX")}
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
                            {new Date(wo.finishedAt).toLocaleDateString(
                              "es-MX",
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div>
                      <Button
                        asChild
                        className={
                          wo.status?.name === "ASIGNADO"
                            ? "bg-cyan-600 hover:bg-cyan-700"
                            : ""
                        }
                      >
                        <Link href={`/fsr/assignments/${wo.id}`}>
                          {wo.status?.name === "CERRADO"
                            ? "Ver"
                            : wo.status?.name === "ASIGNADO"
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
        </CardContent>
      </Card>
    </div>
  );
}
