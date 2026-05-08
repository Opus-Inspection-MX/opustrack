"use client";

import { ArrowLeft, Package, Plus, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IncidentForm } from "@/components/admin/incidents/incident-form";
import { WorkPartEdit } from "@/components/assignments/work-part-edit";
import { WorkPartForm } from "@/components/assignments/work-part-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  getIncidentById,
  getIncidentFormOptions,
} from "@/lib/actions/incidents";
import { getParts } from "@/lib/actions/parts";
import { deleteWorkPart, getWorkParts } from "@/lib/actions/work-parts";

type Incident = Awaited<ReturnType<typeof getIncidentById>>;
type FormOptions = Awaited<ReturnType<typeof getIncidentFormOptions>>;
type Part = Awaited<ReturnType<typeof getParts>>[number];
type WorkPart = Awaited<ReturnType<typeof getWorkParts>>[number];

export default function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const _router = useRouter();
  const [incidentId, setIncidentId] = useState<number | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [formOptions, setFormOptions] = useState<FormOptions | null>(null);
  const [assignmentParts, setAssignmentParts] = useState<
    Record<string, WorkPart[]>
  >({});
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [showPartForm, setShowPartForm] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setIncidentId(parseInt(p.id, 10)));
  }, [params]);

  const fetchData = useCallback(async () => {
    if (!incidentId) return;

    try {
      const [incidentData, options, parts] = await Promise.all([
        getIncidentById(incidentId),
        getIncidentFormOptions(),
        getParts(),
      ]);

      setIncident(incidentData);
      setFormOptions(options);
      setAvailableParts(parts);

      // Fetch parts for each asignación
      if (incidentData?.assignments) {
        const partsPromises = incidentData.assignments.map(async (wo) => {
          const parts = await getWorkParts(wo.id);
          return { id: wo.id.toString(), parts };
        });

        const partsData = await Promise.all(partsPromises);
        const partsMap = partsData.reduce(
          (acc, { id, parts }) => {
            acc[id] = parts;
            return acc;
          },
          {} as Record<string, WorkPart[]>,
        );

        setAssignmentParts(partsMap);
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

  const handleDeletePart = async (_assignmentId: string, partId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta refacción?"))
      return;

    try {
      await deleteWorkPart(partId);
      await fetchData();
    } catch (error) {
      console.error("Error deleting part:", error);
      alert("Error al eliminar la refacción");
    }
  };

  const handlePartSuccess = (assignmentId: string) => {
    setShowPartForm({ ...showPartForm, [assignmentId]: false });
    fetchData();
  };

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
        incident={incident}
        types={formOptions.types}
        statuses={formOptions.statuses}
        vics={formOptions.vics}
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
              const parts = assignmentParts[wo.id] || [];
              const totalCost = parts.reduce(
                (sum, wp) => sum + wp.price * wp.quantity,
                0,
              );

              return (
                <Card key={wo.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Asignación - {wo.assignedTo.name}</CardTitle>
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
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Refacciones Usadas ({parts.length})
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Costo Total: ${totalCost.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            setShowPartForm({
                              ...showPartForm,
                              [wo.id]: !showPartForm[wo.id],
                            })
                          }
                          variant={showPartForm[wo.id] ? "outline" : "default"}
                        >
                          {showPartForm[wo.id] ? (
                            "Cancelar"
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              Agregar Refacción
                            </>
                          )}
                        </Button>
                      </div>

                      {showPartForm[wo.id] && (
                        <WorkPartForm
                          assignmentId={wo.id}
                          parts={availableParts}
                          onSuccess={() => handlePartSuccess(wo.id)}
                          onCancel={() =>
                            setShowPartForm({ ...showPartForm, [wo.id]: false })
                          }
                        />
                      )}

                      {parts.length === 0 && !showPartForm[wo.id] ? (
                        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/30">
                          Sin refacciones aún. Haz clic en "Agregar Refacción"
                          para registrar.
                        </div>
                      ) : (
                        parts.length > 0 && (
                          <div className="border rounded-lg divide-y">
                            {parts.map((wp) => (
                              <div key={wp.id} className="flex items-center">
                                <div className="flex-1">
                                  <WorkPartEdit
                                    workPart={wp}
                                    onSuccess={fetchData}
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePart(wo.id, wp.id)}
                                  className="text-destructive mr-4"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
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
