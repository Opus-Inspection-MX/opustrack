"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Calendar,
  FileText,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { getIncidentById } from "@/lib/actions/incidents";

export default function ClientIncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [incidentId, setIncidentId] = useState<number | null>(null);
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setIncidentId(parseInt(p.id, 10)));
  }, [params]);

  const fetchIncident = useCallback(async () => {
    if (!incidentId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getIncidentById(incidentId);
      setIncident(data);
    } catch (error) {
      console.error("Error fetching incident:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load incident",
      );
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    if (incidentId) {
      fetchIncident();
    }
  }, [incidentId, fetchIncident]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando incidente..." />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/client">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Incidente</h1>
        </div>
        <Card className="border-destructive">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Error al Cargar Incidente
                </h3>
                <p className="text-muted-foreground">
                  {error ||
                    "Incidente no encontrado o no tienes permiso para verlo."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => fetchIncident()} variant="outline">
                  Reintentar
                </Button>
                <Button asChild>
                  <Link href="/client">Volver a Mis Incidentes</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) {
      return (
        <Badge variant="destructive" className="text-lg py-2 px-4">
          Crítica
        </Badge>
      );
    }
    if (priority >= 5) {
      return (
        <Badge variant="default" className="bg-orange-500 text-lg py-2 px-4">
          Alta
        </Badge>
      );
    }
    if (priority >= 3) {
      return (
        <Badge variant="secondary" className="text-lg py-2 px-4">
          Media
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-lg py-2 px-4">
        Baja
      </Badge>
    );
  };

  const getStatusBadge = (status: any) => {
    if (!status) {
      return (
        <Badge variant="outline" className="text-lg py-2 px-4">
          Desconocido
        </Badge>
      );
    }

    return (
      <Badge
        className="text-lg py-2 px-4 text-white"
        style={{ backgroundColor: status.color || "#6B7280" }}
      >
        {status.name}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/client">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{incident.title}</h1>
            {incident.priority >= 8 && (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <p className="text-muted-foreground">Incidente #{incident.id}</p>
        </div>
        <div className="flex gap-3">
          <div className="text-xl">{getPriorityBadge(incident.priority)}</div>
          <div className="text-xl">{getStatusBadge(incident.status)}</div>
        </div>
      </div>

      {/* Incident Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Incidente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Descripción</p>
            <p className="text-base">{incident.description}</p>
          </div>

          <Separator />

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">
                  {incident.type?.name || "Sin tipo"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Prioridad</p>
                <p className="font-medium">{incident.priority}/10</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">SLA</p>
                <p className="font-medium">{incident.sla} horas</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">CVV</p>
                <p className="font-medium">
                  {incident.vic
                    ? `${incident.vic.name} (${incident.vic.code})`
                    : "No asignado"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Reportado por</p>
                <p className="font-medium">
                  {incident.reportedBy?.name || "Desconocido"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Fecha de reporte
                </p>
                <p className="font-medium">
                  {new Date(incident.reportedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {incident.resolvedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Resuelto el</p>
                  <p className="font-medium">
                    {new Date(incident.resolvedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {incident.schedule && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Agenda</p>
                <p className="font-medium">{incident.schedule.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(incident.schedule.scheduledAt).toLocaleString()}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Back Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          Volver
        </Button>
      </div>
    </div>
  );
}
