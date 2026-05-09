"use client";

import { Check, Edit as EditIcon, Save, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateAssignment } from "@/lib/actions/assignments";

type AssignmentEditFormProps = {
  assignment: {
    id: string;
    statusId: number | null;
    status?: {
      id: number;
      name: string;
    } | null;
    notes: string | null;
    folio: number;
    odtFolio: string | null;
    finishedAt: Date | null;
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
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const initialAssigneeIds = assignment.assignees.map((a) => a.user.id);

  const [formData, setFormData] = useState({
    assigneeIds: initialAssigneeIds,
    statusId: assignment.statusId,
    notes: assignment.notes || "",
    odtFolio: assignment.odtFolio || "",
    finishedAt: assignment.finishedAt
      ? new Date(assignment.finishedAt).toISOString().slice(0, 16)
      : "",
  });

  const toggleAssignee = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter((id) => id !== userId)
        : [...prev.assigneeIds, userId],
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await updateAssignment(assignment.id, {
        incidentId: 0,
        assigneeIds: formData.assigneeIds,
        statusId: formData.statusId,
        notes: formData.notes,
        odtFolio: formData.odtFolio,
        finishedAt: formData.finishedAt
          ? new Date(formData.finishedAt)
          : undefined,
      });

      if (!result.success) {
        throw new Error("Failed to update asignación");
      }

      setIsEditing(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error updating asignación:", err);
      setError((err as Error).message || "Error al actualizar la asignación");
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
        ? new Date(assignment.finishedAt).toISOString().slice(0, 16)
        : "",
    });
    setError(null);
    setIsEditing(false);
  };

  const handleUnassignAll = () => {
    setFormData((prev) => ({ ...prev, assigneeIds: [] }));
  };

  const selectedUsers = users.filter((u) =>
    formData.assigneeIds.includes(u.id),
  );

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
              <Label>
                Técnicos Asignados <span className="text-red-500">*</span>
              </Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                  >
                    {selectedUsers.length === 0
                      ? "Seleccionar técnicos"
                      : `${selectedUsers.length} técnico(s) seleccionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <div className="max-h-72 overflow-y-auto">
                    {users.map((user) => {
                      const checked = formData.assigneeIds.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleAssignee(user.id)}
                          className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left"
                        >
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                          {checked && <Check className="h-4 w-4" />}
                        </button>
                      );
                    })}
                    {users.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        No hay usuarios disponibles
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
              {selectedUsers.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleUnassignAll}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="mr-2 h-4 w-4" />
                  Desasignar todos
                </Button>
              )}
              {selectedUsers.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Sin técnicos asignados
                </p>
              )}
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
                  ? new Date(assignment.finishedAt).toLocaleString("es-MX")
                  : "Aún no finalizada"}
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
