"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createWorkOrder, updateWorkOrder, type WorkOrderFormData } from "@/lib/actions/work-orders";

type WorkOrderFormProps = {
  workOrder?: {
    id: string;
    incidentId: number;
    assignedToId: string;
    notes: string | null;
  };
  incidents: Array<{ id: number; title: string; priority: number }>;
  users: Array<{ id: string; name: string }>;
};

export function WorkOrderForm({ workOrder, incidents, users }: WorkOrderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<WorkOrderFormData>({
    incidentId: workOrder?.incidentId || incidents[0]?.id || 0,
    assignedToId: workOrder?.assignedToId || users[0]?.id || "",
    notes: workOrder?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (workOrder) {
        await updateWorkOrder(workOrder.id, formData);
      } else {
        await createWorkOrder(formData);
      }
      router.push("/admin/work-orders");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Detalles de la Orden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="incidentId">Incidente *</Label>
            <Select
              value={formData.incidentId.toString()}
              onValueChange={(value) =>
                setFormData({ ...formData, incidentId: parseInt(value) })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar incidente" />
              </SelectTrigger>
              <SelectContent>
                {incidents.map((incident) => (
                  <SelectItem key={incident.id} value={incident.id.toString()}>
                    {incident.title} (Prioridad: {incident.priority})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedToId">Asignado A *</Label>
            <Select
              value={formData.assignedToId}
              onValueChange={(value) =>
                setFormData({ ...formData, assignedToId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar usuario" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Notas adicionales sobre la orden de trabajo"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : workOrder ? "Actualizar Orden" : "Crear Orden"}
        </Button>
      </div>
    </form>
  );
}
