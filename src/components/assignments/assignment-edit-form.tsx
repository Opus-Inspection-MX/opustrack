"use client";

import { Edit as EditIcon, Save, X } from "lucide-react";
import { useState } from "react";
import { FsrAvailabilitySelect } from "@/components/assignments/fsr-availability-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFsrAvailability } from "@/hooks/use-fsr-availability";
import { toast } from "@/hooks/use-toast";
import { updateAssignment } from "@/lib/actions/assignments";
import { isFailure } from "@/lib/actions/result";
import { logger } from "@/lib/observability/logger";
import {
  formatMX,
  fromDateInputMX,
  fromDatetimeLocalMX,
  toDateInputMX,
  toDatetimeLocalMX,
} from "@/lib/utils/datetime";

type AssignmentEditFormProps = {
  assignment: {
    id: string;
    incidentId?: number;
    incident?: { id: number } | null;
    statusId: number | null;
    status?: {
      id: number;
      name: string;
    } | null;
    notes: string | null;
    folio: number;
    odtFolio: string | null;
    finishedAt: Date | null;
    scheduledDate?: Date | null;
    assignees: Array<{ user: { id: string; name: string } }>;
  };
  users: Array<{ id: string; name: string; email: string }>;
  statuses: Array<{ id: number; name: string }>;
  onSuccess?: () => void;
};

export function AssignmentEditForm({
  assignment,
  users,
  statuses,
  onSuccess,
}: AssignmentEditFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const initialAssigneeIds = assignment.assignees.map((a) => a.user.id);

  const [formData, setFormData] = useState({
    assigneeIds: initialAssigneeIds,
    statusId: assignment.statusId,
    notes: assignment.notes || "",
    odtFolio: assignment.odtFolio || "",
    finishedAt: assignment.finishedAt
      ? toDatetimeLocalMX(assignment.finishedAt)
      : "",
    scheduledDate: assignment.scheduledDate
      ? toDateInputMX(assignment.scheduledDate)
      : "",
  });

  const availability = useFsrAvailability(
    {
      incidentId: assignment.incidentId ?? assignment.incident?.id ?? 0,
      assignmentId: assignment.id,
      scheduledDate: formData.scheduledDate || null,
    },
    isEditing,
  );

  const handleSave = async () => {
    setLoading(true);

    try {
      const result = await updateAssignment(assignment.id, {
        // The update action resolves the incident from the assignment id, so
        // no incidentId is sent (a dummy 0 fails validation and rejects the save).
        assigneeIds: formData.assigneeIds,
        statusId: formData.statusId,
        notes: formData.notes,
        odtFolio: formData.odtFolio,
        finishedAt: formData.finishedAt
          ? fromDatetimeLocalMX(formData.finishedAt)
          : undefined,
        scheduledDate:
          formData.scheduledDate ===
          (assignment.scheduledDate
            ? toDateInputMX(assignment.scheduledDate)
            : "")
            ? undefined
            : formData.scheduledDate
              ? fromDateInputMX(formData.scheduledDate)
              : null,
      });

      if (isFailure(result)) {
        toast.error(result.error);
        availability.retry();
        return;
      }

      setIsEditing(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      logger.error("Error updating asignación:", err);
      toast.error(
        (err as Error).message || "Error al actualizar la asignación",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      assigneeIds: initialAssigneeIds,
      statusId: assignment.statusId,
      notes: assignment.notes || "",
      odtFolio: assignment.odtFolio || "",
      finishedAt: assignment.finishedAt
        ? toDatetimeLocalMX(assignment.finishedAt)
        : "",
      scheduledDate: assignment.scheduledDate
        ? toDateInputMX(assignment.scheduledDate)
        : "",
    });
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Detalles de la Asignación</CardTitle>
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
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="assignment-edit-fsrs">
                Técnicos Asignados <span className="text-red-500">*</span>
              </Label>
              <FsrAvailabilitySelect
                id="assignment-edit-fsrs"
                options={users.map((user) => ({
                  value: user.id,
                  label: user.name,
                  sublabel: user.email,
                }))}
                selectedOptions={assignment.assignees.map(({ user }) => ({
                  value: user.id,
                  label: user.name,
                }))}
                value={formData.assigneeIds}
                onValueChange={(assigneeIds) =>
                  setFormData((previous) => ({ ...previous, assigneeIds }))
                }
                availability={availability}
                scheduledDate={formData.scheduledDate || null}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="odtFolio">Folio ODT</Label>
              <Input
                id="odtFolio"
                value={formData.odtFolio}
                onChange={(e) =>
                  setFormData({ ...formData, odtFolio: e.target.value })
                }
                placeholder="Capturar folio ODT del sistema externo"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Requerido para finalizar la asignación.
              </p>
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
              <Label htmlFor="scheduledDate">Fecha programada (opcional)</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={formData.scheduledDate}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledDate: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Si se especifica, los técnicos no pueden tener vacaciones
                aprobadas ni día festivo en esta fecha.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Agregar notas sobre esta asignación..."
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
              <p className="font-medium">
                {assignment.assignees.map((a) => a.user.name).join(", ") ||
                  "Sin asignar"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <p className="font-medium">
                {assignment.status?.name || "Sin estado"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Folio</p>
              <p className="font-medium">AS-{assignment.folio}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Folio ODT</p>
              <p className="font-medium">
                {assignment.odtFolio || (
                  <span className="text-muted-foreground italic">
                    No registrado
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Fecha de Finalización
              </p>
              <p className="font-medium">
                {assignment.finishedAt
                  ? formatMX(assignment.finishedAt)
                  : "Aún no finalizada"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha programada</p>
              <p className="font-medium">
                {assignment.scheduledDate
                  ? formatMX(assignment.scheduledDate, { dateStyle: "short" })
                  : "No especificada"}
              </p>
            </div>
            {assignment.notes && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm mt-1">{assignment.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
