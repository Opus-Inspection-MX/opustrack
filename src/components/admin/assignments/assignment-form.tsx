"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    priority: number;
    vicId?: string | null;
    assigneeIds?: string[];
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
}: AssignmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Status is managed by the state machine, not picked here.
  const [formData, setFormData] = useState<AssignmentFormData>({
    incidentId: assignment?.incidentId || incidents[0]?.id || 0,
    assigneeIds: assignment?.assigneeIds || [],
    statusId: assignment?.statusId ?? null,
    notes: assignment?.notes || "",
  });

  // Filter FSRs to those enabled in the selected incident (RF-025)
  const selectedIncident = incidents.find(
    (inc) => inc.id === formData.incidentId,
  );
  const authorizedAssigneeIds = selectedIncident?.assigneeIds ?? [];
  const filteredUsers = users.filter((user) =>
    authorizedAssigneeIds.includes(user.id),
  );

  // When incident changes, drop assignees not authorized in the new incident
  useEffect(() => {
    setFormData((prev) => {
      const filtered = prev.assigneeIds.filter((id) =>
        authorizedAssigneeIds.includes(id),
      );
      if (filtered.length === prev.assigneeIds.length) return prev;
      return { ...prev, assigneeIds: filtered };
    });
  }, [authorizedAssigneeIds]);

  const toggleAssignee = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter((id) => id !== userId)
        : [...prev.assigneeIds, userId],
    }));
  };

  const selectedUsers = users.filter((u) =>
    formData.assigneeIds.includes(u.id),
  );

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
            <Label>Asignados *</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal"
                >
                  {selectedUsers.length === 0
                    ? "Seleccionar técnicos"
                    : `${selectedUsers.length} seleccionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <div className="max-h-72 overflow-y-auto">
                  {filteredUsers.map((user) => {
                    const checked = formData.assigneeIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleAssignee(user.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left"
                      >
                        <span>{user.name}</span>
                        {checked && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      Esta incidencia no tiene FSRs habilitados. Asígnalos desde
                      la incidencia primero.
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedUsers.map((u) => (
                  <Badge
                    key={u.id}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => toggleAssignee(u.id)}
                  >
                    {u.name} <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/*
           * Estado: el state machine lo administra automáticamente
           * (PENDIENTE_DE_ASIGNACION → ASIGNADO al agregar el primer FSR;
           * VISTO/INICIADO/PENDIENTE/CERRADO desde el detalle del FSR).
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
              ? "Actualizar Orden"
              : "Crear Orden"}
        </Button>
      </div>
    </form>
  );
}
