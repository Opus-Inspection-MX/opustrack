"use client";

import { ArrowLeft, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IncidentForm } from "@/components/admin/incidents/incident-form";
import { AssignmentItems } from "@/components/assignments/assignment-items";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { getAssignmentItems } from "@/lib/actions/assignment-items";
import {
  getIncidentById,
  getIncidentFormOptions,
} from "@/lib/actions/incidents";

type Incident = Awaited<ReturnType<typeof getIncidentById>>;
type FormOptions = Awaited<ReturnType<typeof getIncidentFormOptions>>;
type AssignmentItem = Awaited<ReturnType<typeof getAssignmentItems>>[number];

export default function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const _router = useRouter();
  const [incidentId, setIncidentId] = useState<number | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [formOptions, setFormOptions] = useState<FormOptions | null>(null);
  const [assignmentItems, setAssignmentItems] = useState<
    Record<string, AssignmentItem[]>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setIncidentId(parseInt(p.id, 10)));
  }, [params]);

  const fetchData = useCallback(async () => {
    if (!incidentId) return;

    try {
      const [incidentData, options] = await Promise.all([
        getIncidentById(incidentId),
        getIncidentFormOptions(),
      ]);

      setIncident(incidentData);
      setFormOptions(options);

      // The open list of parts/equipment, per assignment.
      if (incidentData?.assignments) {
        const entries = await Promise.all(
          incidentData.assignments.map(async (wo) => {
            const items = await getAssignmentItems(wo.id);
            return [wo.id.toString(), items] as const;
          }),
        );
        setAssignmentItems(Object.fromEntries(entries));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    if (incidentId) {
      fetchData();
    }
  }, [incidentId, fetchData]);

  if (loading || !incident || !formOptions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando incidente..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/incidents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Incidente</h1>
          <p className="text-muted-foreground">
            Actualizar informacion del incidente: {incident.title}
          </p>
        </div>
      </div>

      <IncidentForm
        incident={{
          ...incident,
          assigneeIds: incident.assignees?.map((a) => a.user.id) ?? [],
        }}
        types={formOptions.types}
        statuses={formOptions.statuses}
        clientes={formOptions.clientes}
        users={formOptions.users}
        schedules={formOptions.schedules}
      />

      {incident.assignments && incident.assignments.length > 0 && (
        <>
          <Separator />

          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Wrench className="h-6 w-6" />
                Asignaciones y Refacciones
              </h2>
              <p className="text-sm text-muted-foreground">
                Gestionar refacciones usadas en asignaciones
              </p>
            </div>

            {incident.assignments?.map((wo) => {
              const items = assignmentItems[wo.id] || [];

              return (
                <Card key={wo.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          Asignación -{" "}
                          {wo.assignees.map((a) => a.user.name).join(", ") ||
                            "Sin asignar"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Estado: {wo.status?.name || "Sin estado"} •{" "}
                          {wo._count?.assignmentActivities || 0} actividades
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/assignments/${wo.id}/edit`}>
                          Ver Detalle Completo
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AssignmentItems
                      assignmentId={wo.id}
                      items={items}
                      onChange={fetchData}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
