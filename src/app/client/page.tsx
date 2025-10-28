import { getClientIncidents } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Clock, CheckCircle, Building } from "lucide-react";
import Link from "next/link";
import { getMyProfile } from "@/lib/actions/users";

export default async function ClientDashboard() {
  await requireRouteAccess("/client");
  const incidents = await getClientIncidents();
  const user = await getMyProfile();

  // Calculate stats
  const stats = {
    open: incidents.filter((i) => i.status?.name === "ABIERTO").length,
    inProgress: incidents.filter((i) => i.status?.name === "EN_PROGRESO" || i.status?.name === "PENDIENTE").length,
    closed: incidents.filter((i) => i.status?.name === "CERRADO").length,
    total: incidents.length,
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) {
      return <Badge variant="destructive">Crítica</Badge>;
    }
    if (priority >= 5) {
      return <Badge variant="default" className="bg-orange-500">Alta</Badge>;
    }
    if (priority >= 3) {
      return <Badge variant="secondary">Media</Badge>;
    }
    return <Badge variant="outline">Baja</Badge>;
  };

  const getStatusBadge = (statusName: string | undefined) => {
    if (!statusName) return <Badge variant="outline">Desconocido</Badge>;

    if (statusName === "ABIERTO") {
      return <Badge variant="default" className="bg-blue-600">Abierto</Badge>;
    }
    if (statusName === "EN_PROGRESO" || statusName === "PENDIENTE") {
      return <Badge variant="secondary">En Progreso</Badge>;
    }
    if (statusName === "CERRADO") {
      return <Badge variant="default" className="bg-green-600">Cerrado</Badge>;
    }
    return <Badge variant="outline">{statusName}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis Incidentes</h1>
          <p className="text-muted-foreground mt-2">
            Rastrea y reporta incidentes para tu CVV
          </p>
        </div>
        <Button asChild>
          <Link href="/client/new">
            <Plus className="h-4 w-4 mr-2" />
            Reportar Incidente
          </Link>
        </Button>
      </div>

      {/* VIC Info */}
      {user?.vic && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Tu CVV</p>
                <p className="font-medium">{user.vic.name} ({user.vic.code})</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidentes Totales</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Histórico</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abiertos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
            <p className="text-xs text-muted-foreground">Esperando respuesta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Resolviéndose</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resueltos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closed}</div>
            <p className="text-xs text-muted-foreground">Completados</p>
          </CardContent>
        </Card>
      </div>

      {/* Incidents List */}
      <Card>
        <CardHeader>
          <CardTitle>Incidentes Recientes</CardTitle>
          <CardDescription>Tus incidentes reportados y su estado</CardDescription>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No hay incidentes reportados aún</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/client/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Reporta tu Primer Incidente
                </Link>
              </Button>
            </div>
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
                        #{incident.id}
                      </span>
                      {getPriorityBadge(incident.priority)}
                      {getStatusBadge(incident.status?.name)}
                      {incident.type && (
                        <Badge variant="outline">{incident.type.name}</Badge>
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
                        Reportado: {new Date(incident.reportedAt).toLocaleDateString()}
                      </span>
                      <span>SLA: {incident.sla}h</span>
                      {incident._count?.workOrders && incident._count.workOrders > 0 && (
                        <span>Órdenes de Trabajo: {incident._count.workOrders}</span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/client/incidents/${incident.id}`}>
                      Ver Detalles
                    </Link>
                  </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button asChild variant="outline" className="h-auto py-4">
              <Link href="/client/new" className="flex flex-col items-center gap-2">
                <Plus className="h-6 w-6" />
                <span>Reportar Nuevo Incidente</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link href="/profile" className="flex flex-col items-center gap-2">
                <Building className="h-6 w-6" />
                <span>Mi Perfil</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
