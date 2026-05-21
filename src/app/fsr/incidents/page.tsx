import { AlertTriangle, Building2, Calendar, Eye, User } from "lucide-react";
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
import { getMyIncidents } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function FSRIncidentsPage() {
  await requireRouteAccess("/fsr");
  const incidents = await getMyIncidents();

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "text-red-600 font-bold";
    if (priority >= 5) return "text-orange-600 font-semibold";
    return "text-blue-600";
  };

  const getStatusColor = (statusName: string | undefined) => {
    switch (statusName) {
      case "ABIERTO":
        return "bg-slate-100 text-slate-700 border-slate-300";
      case "ASIGNADO":
        return "bg-purple-100 text-purple-700 border-purple-300";
      case "VISTO":
        return "bg-cyan-100 text-cyan-700 border-cyan-300";
      case "INICIADO":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "CERRADO":
        return "bg-green-100 text-green-700 border-green-300";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mis Incidentes</h1>
        <p className="text-muted-foreground mt-2">
          Incidentes relacionados con tus asignaciones asignadas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incidentes ({incidents.length})</CardTitle>
          <CardDescription>
            Mostrando incidentes que tienen asignaciones asignadas a ti
          </CardDescription>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No hay incidentes relacionados con tus asignaciones</p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {incident.status && (
                          <Badge
                            variant="outline"
                            className={getStatusColor(incident.status.name)}
                          >
                            {incident.status.name}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={getPriorityColor(incident.priority)}
                        >
                          Prioridad: {incident.priority}/10
                        </Badge>
                        {incident.type && (
                          <Badge variant="outline">{incident.type.name}</Badge>
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-lg">
                          {incident.title}
                        </h3>
                        {incident.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {incident.description}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        {incident.vic && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span>{incident.vic.name}</span>
                          </div>
                        )}
                        {incident.reportedBy && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{incident.reportedBy.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(incident.reportedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {incident._count.assignments} asignación(es)
                        <span className="ml-4">
                          SLA:{" "}
                          {incident.type?.sla != null
                            ? `${incident.type.sla}h`
                            : "Sin SLA"}
                        </span>
                      </div>
                    </div>

                    <Button asChild variant="outline" size="sm">
                      <Link href={`/fsr/incidents/${incident.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Link>
                    </Button>
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
