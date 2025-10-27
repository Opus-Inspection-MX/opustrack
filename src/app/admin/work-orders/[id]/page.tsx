import { getWorkOrderById } from "@/lib/actions/work-orders";
import { getWorkActivities } from "@/lib/actions/work-activities";
import { getWorkParts } from "@/lib/actions/work-parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [workOrder, activities, workParts] = await Promise.all([
    getWorkOrderById(id),
    getWorkActivities(id),
    getWorkParts(id),
  ]);

  if (!workOrder) notFound();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETADO":
        return "default";
      case "EN_PROGRESO":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/work-orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Orden de Trabajo</h1>
          <p className="text-muted-foreground">{workOrder.incident.title}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/admin/work-orders/${id}/edit`}>Editar</Link>
        </Button>
      </div>

      {/* Parent Incident Link */}
      <Card className="bg-muted/30">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Parent Incident</p>
              <p className="font-medium">{workOrder.incident.title}</p>
              <p className="text-xs text-muted-foreground">
                Priority: {workOrder.incident.priority}/10 • Status: {workOrder.incident.status?.name}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/incidents/${workOrder.incident.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Incident
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Detalles de la Orden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Incidente</p>
                <p className="font-medium">{workOrder.incident.title}</p>
                {workOrder.incident.type && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tipo: {workOrder.incident.type.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Asignado a</p>
                <p className="font-medium">{workOrder.assignedTo.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                {workOrder.status ? (
                  <Badge variant="secondary">
                    {workOrder.status.name}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Sin estado</span>
                )}
              </div>
            </div>

            {workOrder.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm mt-1">{workOrder.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Actividades</p>
                <p className="text-2xl font-bold">{activities.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Partes Usadas</p>
                <p className="text-2xl font-bold">{workParts.length}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Fecha de Creacion</p>
              <p className="font-medium">
                {new Date(workOrder.createdAt).toLocaleString('es-MX')}
              </p>
            </div>

            {workOrder.startedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Iniciado</p>
                <p className="font-medium">
                  {new Date(workOrder.startedAt).toLocaleString('es-MX')}
                </p>
              </div>
            )}

            {workOrder.finishedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Finalizado</p>
                <p className="font-medium">
                  {new Date(workOrder.finishedAt).toLocaleString('es-MX')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividades Realizadas</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay actividades registradas
            </p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="border-l-2 border-primary pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{activity.description}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(activity.performedAt).toLocaleString('es-MX')}
                      </p>
                      {activity.workParts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {activity.workParts.map((wp) => (
                            <Badge key={wp.id} variant="outline">
                              {wp.part.name} x{wp.quantity}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partes Utilizadas</CardTitle>
        </CardHeader>
        <CardContent>
          {workParts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay partes registradas
            </p>
          ) : (
            <div className="space-y-2">
              {workParts.map((wp) => (
                <div key={wp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{wp.part.name}</p>
                    {wp.description && (
                      <p className="text-sm text-muted-foreground">{wp.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">x{wp.quantity}</Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${(wp.part.price * wp.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
              <div className="pt-4 text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold">
                  $
                  {workParts
                    .reduce((sum, wp) => sum + wp.part.price * wp.quantity, 0)
                    .toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
