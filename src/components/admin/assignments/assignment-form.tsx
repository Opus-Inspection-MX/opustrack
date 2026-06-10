"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
    assigneeIds: string[];
    notes: string | null;
    statusId?: number | null;
  };
  incidents: Array<{
    id: number;
    title: string;
    clienteId?: string | null;
    assigneeIds?: string[];
  }>;
  users: Array<{ id: string; name: string; clienteIds?: string[] }>;
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
}: AssignmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status is managed by the state machine, not picked here.
  const [formData, setFormData] = useState<AssignmentFormData>({
    incidentId: assignment?.incidentId || incidents[0]?.id || 0,
    assigneeIds: assignment?.assigneeIds || [],
    statusId: assignment?.statusId ?? null,
    notes: assignment?.notes || "",
  });

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
          <CardTitle>Detalles de la Asignación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="incidentId">Incidente *</Label>
            <SearchableSelect
              options={incidents.map((incident) => ({
                value: incident.id.toString(),
                label: incident.title,
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
            <Label>Asignados *</Label>
            <MultiSelect
              options={users.map((user) => ({
                value: user.id,
                label: user.name,
              }))}
              value={formData.assigneeIds}
              onValueChange={(ids) =>
                setFormData({ ...formData, assigneeIds: ids })
              }
              placeholder="Seleccionar FSRs"
              searchPlaceholder="Buscar FSR..."
              emptyMessage="No se encontraron FSRs."
            />
          </div>

          {/*
           * Estado: el state machine lo administra automáticamente
           * (PENDIENTE_DE_ASIGNACION → ASIGNADO al agregar el primer FSR;
           * VISTO/INICIADO/EN_PROGRESO/CERRADO desde el detalle del FSR).
           * No se permite editar manualmente desde aquí.
           */}

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
              ? "Actualizar Asignación"
              : "Crear Asignación"}
        </Button>
      </div>
    </form>
  );
}
