"use client";

import { Edit as EditIcon, Save, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateWorkOrder } from "@/lib/actions/work-orders";

type WorkOrderEditFormProps = {
  workOrder: {
    id: string;
    statusId: number | null;
    status?: {
      id: number;
      name: string;
    } | null;
    assignedToId: string;
    notes: string | null;
    folio: string | null;
    finishedAt: Date | null;
    assignedTo: {
      id: string;
      name: string;
    };
  };
  users: Array<{ id: string; name: string; email: string }>;
  statuses: Array<{ id: number; name: string }>;
  onSuccess?: () => void;
};

export function WorkOrderEditForm({
  workOrder,
  users,
  statuses,
  onSuccess,
}: WorkOrderEditFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    assignedToId: workOrder.assignedToId,
    statusId: workOrder.statusId,
    notes: workOrder.notes || "",
    folio: workOrder.folio || "",
    finishedAt: workOrder.finishedAt
      ? new Date(workOrder.finishedAt).toISOString().slice(0, 16)
      : "",
  });

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await updateWorkOrder(workOrder.id, {
        incidentId: 0, // Not used in update, but required by type
        assignedToId: formData.assignedToId,
        statusId: formData.statusId,
        notes: formData.notes,
        folio: formData.folio,
        finishedAt: formData.finishedAt
          ? new Date(formData.finishedAt)
          : undefined,
      });

      if (!result.success) {
        throw new Error("Failed to update work order");
      }

      setIsEditing(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error updating work order:", err);
      setError((err as Error).message || "Error al actualizar la orden de trabajo");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      assignedToId: workOrder.assignedToId,
      statusId: workOrder.statusId,
      notes: workOrder.notes || "",
      folio: workOrder.folio || "",
      finishedAt: workOrder.finishedAt
        ? new Date(workOrder.finishedAt).toISOString().slice(0, 16)
        : "",
    });
    setError(null);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Detalles de la Orden</CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <EditIcon className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <FormError message={error} />}

        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="assignedTo">
                Asignado A <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                options={users.map((user) => ({
                  value: user.id,
                  label: `${user.name} (${user.email})`,
                }))}
                value={formData.assignedToId}
                onValueChange={(value) =>
                  setFormData({ ...formData, assignedToId: value })
                }
                placeholder="Seleccionar usuario"
                searchPlaceholder="Buscar usuarios..."
                emptyMessage="No se encontraron usuarios."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">
                Estado <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.statusId?.toString() || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    statusId: value === "none" ? null : parseInt(value, 10),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin estado</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="folio">Número de Folio</Label>
              <Input
                id="folio"
                value={formData.folio}
                onChange={(e) =>
                  setFormData({ ...formData, folio: e.target.value })
                }
                placeholder="Ingrese el número de folio"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finishedAt">Fecha de Finalización</Label>
              <Input
                id="finishedAt"
                type="datetime-local"
                value={formData.finishedAt}
                onChange={(e) =>
                  setFormData({ ...formData, finishedAt: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Agregar notas sobre esta orden de trabajo..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? (
                  "Guardando..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Asignado A</p>
              <p className="font-medium">{workOrder.assignedTo?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <p className="font-medium">
                {workOrder.status?.name || "Sin estado"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Número de Folio</p>
              <p className="font-medium">{workOrder.folio || "No asignado"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha de Finalización</p>
              <p className="font-medium">
                {workOrder.finishedAt
                  ? new Date(workOrder.finishedAt).toLocaleString("es-MX")
                  : "Aún no finalizada"}
              </p>
            </div>
            {workOrder.notes && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm mt-1">{workOrder.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
