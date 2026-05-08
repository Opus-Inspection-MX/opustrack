"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  type AssignmentFormData,
  createAssignment,
  updateAssignment,
} from "@/lib/actions/assignments";

type AssignmentFormProps = {
  assignment?: {
    id: string;
    incidentId: number;
    assignedToId: string;
    notes: string | null;
    statusId?: number | null;
  };
  incidents: Array<{
    id: number;
    title: string;
    priority: number;
    vicId?: string | null;
  }>;
  users: Array<{ id: string; name: string; vicIds?: string[] }>;
  assignmentStatuses: Array<{
    id: number;
    name: string;
    color: string;
    active: boolean;
  }>;
};

export function AssignmentForm({
  assignment,
  incidents,
  users,
  assignmentStatuses,
}: AssignmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find PENDIENTE status as default
  const pendienteStatus = assignmentStatuses.find(
    (status) => status.name === "PENDIENTE",
  );

  const [formData, setFormData] = useState<AssignmentFormData>({
    incidentId: assignment?.incidentId || incidents[0]?.id || 0,
    assignedToId: assignment?.assignedToId || users[0]?.id || "",
    statusId: assignment?.statusId || pendienteStatus?.id || null,
    notes: assignment?.notes || "",
  });

  // Filter FSRs based on selected incident's VIC
  const selectedIncident = incidents.find(
    (inc) => inc.id === formData.incidentId,
  );
  const selectedVicId = selectedIncident?.vicId;
  const filteredUsers = selectedVicId
    ? users.filter((user) => user.vicIds?.includes(selectedVicId))
    : users;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (assignment) {
        await updateAssignment(assignment.id, formData);
      } else {
        await createAssignment(formData);
      }
      router.push("/admin/assignments");
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
            <SearchableSelect
              options={incidents.map((incident) => ({
                value: incident.id.toString(),
                label: `${incident.title} (Prioridad: ${incident.priority})`,
              }))}
              value={formData.incidentId.toString()}
              onValueChange={(value) =>
                setFormData({ ...formData, incidentId: parseInt(value, 10) })
              }
              placeholder="Seleccionar incidente"
              searchPlaceholder="Buscar incidente..."
              emptyMessage="No se encontraron incidentes."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedToId">Asignado A *</Label>
            <SearchableSelect
              options={filteredUsers.map((user) => ({
                value: user.id,
                label: user.name,
              }))}
              value={formData.assignedToId}
              onValueChange={(value) =>
                setFormData({ ...formData, assignedToId: value })
              }
              placeholder="Seleccionar usuario"
              searchPlaceholder="Buscar usuario..."
              emptyMessage="No se encontraron usuarios."
            />
            {filteredUsers.length === 0 && selectedIncident?.vicId && (
              <p className="text-xs text-muted-foreground">
                No FSRs assigned to this VIC
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="statusId">Estado</Label>
            <Select
              value={formData.statusId?.toString() || ""}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  statusId: value ? parseInt(value, 10) : null,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {assignmentStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.id.toString()}>
                    {status.name}
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
              placeholder="Notas adicionales sobre la asignación"
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
          {loading
            ? "Guardando..."
            : assignment
              ? "Actualizar Orden"
              : "Crear Orden"}
        </Button>
      </div>
    </form>
  );
}
