"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Wrench, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { getIncidentById, getIncidentFormOptions } from "@/lib/actions/incidents";
import { IncidentForm } from "@/components/admin/incidents/incident-form";
import { getWorkParts, deleteWorkPart } from "@/lib/actions/work-parts";
import { WorkPartForm } from "@/components/work-orders/work-part-form";
import { WorkPartEdit } from "@/components/work-orders/work-part-edit";
import { getParts } from "@/lib/actions/parts";

export default function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [incidentId, setIncidentId] = useState<number | null>(null);
  const [incident, setIncident] = useState<any>(null);
  const [formOptions, setFormOptions] = useState<any>(null);
  const [workOrderParts, setWorkOrderParts] = useState<Record<string, any[]>>({});
  const [availableParts, setAvailableParts] = useState<any[]>([]);
  const [showPartForm, setShowPartForm] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setIncidentId(parseInt(p.id)));
  }, [params]);

  useEffect(() => {
    if (incidentId) {
      fetchData();
    }
  }, [incidentId]);

  const fetchData = async () => {
    if (!incidentId) return;

    try {
      setLoading(true);
      const [incidentData, options, partsData] = await Promise.all([
        getIncidentById(incidentId),
        getIncidentFormOptions(),
        getParts(),
      ]);

      setIncident(incidentData);
      setFormOptions(options);
      setAvailableParts(partsData);

      // Fetch parts for each work order
      if (incidentData?.workOrders) {
        const partsPromises = incidentData.workOrders.map((wo: any) =>
          getWorkParts(wo.id)
        );
        const partsResults = await Promise.all(partsPromises);
        const partsMap: Record<string, any[]> = {};
        incidentData.workOrders.forEach((wo: any, idx: number) => {
          partsMap[wo.id] = partsResults[idx];
        });
        setWorkOrderParts(partsMap);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePart = async (workOrderId: string, partId: string) => {
    if (!confirm("Are you sure you want to remove this part?")) return;

    try {
      await deleteWorkPart(partId);
      await fetchData();
    } catch (error) {
      console.error("Error deleting part:", error);
      alert("Failed to remove part");
    }
  };

  const handlePartSuccess = (workOrderId: string) => {
    setShowPartForm({ ...showPartForm, [workOrderId]: false });
    fetchData();
  };

  if (loading || !incident || !formOptions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading incident..." />
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

      {incident.workOrders && incident.workOrders.length > 0 && (
        <>
          <Separator />

          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Wrench className="h-6 w-6" />
                Work Orders & Parts
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage parts used in work orders
              </p>
            </div>

            {incident.workOrders.map((wo: any) => {
              const parts = workOrderParts[wo.id] || [];
              const totalCost = parts.reduce(
                (sum, wp) => sum + wp.price * wp.quantity,
                0
              );

              return (
                <Card key={wo.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          Work Order - {wo.assignedTo.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Status: {wo.status?.name || "No status"} •{" "}
                          {wo._count?.workActivities || 0} activities
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/admin/work-orders/${wo.id}/edit`}>
                          View Full Details
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
                            Parts Used ({parts.length})
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Total Cost: ${totalCost.toFixed(2)}
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
                          {showPartForm[wo.id] ? "Cancel" : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Part
                            </>
                          )}
                        </Button>
                      </div>

                      {showPartForm[wo.id] && (
                        <WorkPartForm
                          workOrderId={wo.id}
                          parts={availableParts}
                          onSuccess={() => handlePartSuccess(wo.id)}
                          onCancel={() =>
                            setShowPartForm({ ...showPartForm, [wo.id]: false })
                          }
                        />
                      )}

                      {parts.length === 0 && !showPartForm[wo.id] ? (
                        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/30">
                          No parts used yet. Click "Add Part" to record parts.
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
