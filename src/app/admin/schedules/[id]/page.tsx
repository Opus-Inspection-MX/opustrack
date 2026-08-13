"use client";

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Edit,
  ExternalLink,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getScheduleById } from "@/lib/actions/schedules";
import { formatMX } from "@/lib/utils/datetime";

interface ScheduleIncident {
  id: number;
  title: string;
  type?: { name: string } | null;
  status?: { name: string } | null;
  reportedAt: Date | string;
  reportedBy?: { name: string } | null;
}

interface Schedule {
  id: string;
  title: string;
  description?: string | null;
  scheduledAt: Date;
  endDate?: Date | null;
  clientes: Array<{
    clienteId: string;
    active: boolean;
    cliente: { id: string; name: string; code: string };
  }>;
  incidents: ScheduleIncident[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default function ViewSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const _router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        const data = await getScheduleById(id);
        setSchedule(data as Schedule);
      } catch (error) {
        console.error("Error fetching schedule:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" text="Cargando programación..." />
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">
              Programación no encontrada
            </p>
            <Link href="/admin/schedules">
              <Button className="mt-4">Volver a Programación</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getScheduleStatus = () => {
    const now = new Date();
    const scheduleDate = new Date(schedule.scheduledAt);

    if (scheduleDate < now) {
      return {
        label: "Pasado",
        variant: "secondary" as const,
        color: "text-gray-600",
      };
    } else if (scheduleDate.toDateString() === now.toDateString()) {
      return {
        label: "Hoy",
        variant: "default" as const,
        color: "text-blue-600",
      };
    } else {
      return {
        label: "Próximo",
        variant: "outline" as const,
        color: "text-green-600",
      };
    }
  };

  const status = getScheduleStatus();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/schedules">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Regresar
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Detalles de la Programación</h1>
            <p className="text-muted-foreground">
              Ver información de la programación
            </p>
          </div>
        </div>
        <Link href={`/admin/schedules/${schedule.id}/edit`}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Editar Programación
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Información Básica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Título
              </p>
              <p className="text-lg font-semibold">{schedule.title}</p>
            </div>

            {schedule.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Descripción
                </p>
                <p className="text-sm">{schedule.description}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Estado
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={status.variant}>{status.label}</Badge>
                <Badge variant={schedule.active ? "default" : "secondary"}>
                  {schedule.active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Información de la Programación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Fecha y Hora Programada
              </p>
              <p className="text-lg font-semibold">
                {formatMX(schedule.scheduledAt)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Fecha de fin
              </p>
              <p className="text-sm">
                {schedule.endDate
                  ? formatMX(schedule.endDate)
                  : "Sin fecha de fin"}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Clientes asignados
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {schedule.clientes.filter((sv) => sv.active).length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Sin Clientes
                  </span>
                ) : (
                  schedule.clientes
                    .filter((sv) => sv.active)
                    .map((sv) => (
                      <Badge
                        key={sv.clienteId}
                        variant="secondary"
                        className="gap-1"
                      >
                        <Building2 className="h-3 w-3" />
                        {sv.cliente.code} — {sv.cliente.name}
                      </Badge>
                    ))
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Incidentes Relacionados
              </p>
              <p className="text-lg font-semibold">
                {schedule.incidents?.length || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Fechas de Registro</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Creado El
              </p>
              <p className="text-sm">{formatMX(schedule.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Última Actualización
              </p>
              <p className="text-sm">{formatMX(schedule.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Incidents Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Incidentes Programados ({schedule.incidents?.length || 0})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {schedule.incidents && schedule.incidents.length > 0 ? (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Reportado Por
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Fecha de Reporte
                    </TableHead>
                    <TableHead className="w-[70px]">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.incidents.map((incident: ScheduleIncident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="truncate">{incident.title}</span>
                          <div className="md:hidden flex flex-wrap gap-1 mt-1">
                            {incident.type && (
                              <Badge variant="outline" className="text-xs">
                                {incident.type.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {incident.type ? (
                          <Badge variant="outline">{incident.type.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Sin tipo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {incident.status ? (
                          <Badge variant="secondary">
                            {incident.status.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Sin estado
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {incident.reportedBy ? (
                          <span className="text-sm">
                            {incident.reportedBy.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Desconocido
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {formatMX(incident.reportedAt, { dateStyle: "short" })}
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/incidents/${incident.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay incidentes programados para esta fecha</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
