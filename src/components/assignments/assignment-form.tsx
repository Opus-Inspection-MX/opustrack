"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { type AssignmentFormData, assignmentSchema } from "@/lib/validations";

interface AssignmentData {
  incidentId?: string;
  assigneeIds?: string[];
  status?: { name: string } | null;
  notes?: string;
  startedAt?: string | Date;
  finishedAt?: string | Date;
}

interface IncidentData {
  id?: string;
  title?: string;
  priority?: string;
  vic?: { name?: string } | null;
}

interface ZodIssue {
  path?: (string | number)[];
  message: string;
}

interface AssignmentFormProps {
  assignment?: AssignmentData;
  incident?: IncidentData;
  onClose?: () => void;
}

export function AssignmentForm({
  assignment,
  incident,
  onClose,
}: AssignmentFormProps) {
  const [formData, setFormData] = useState<AssignmentFormData>({
    incidentId: "",
    assigneeIds: [],
    status: "PENDING",
    notes: "",
    startedAt: "",
    finishedAt: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const router = useRouter();

  // Mock data - replace with actual API calls
  const users = [
    { id: "user_001", name: "John Doe", role: "Technician" },
    { id: "user_002", name: "Jane Smith", role: "System Admin" },
    { id: "user_003", name: "Mike Johnson", role: "Network Specialist" },
    { id: "user_004", name: "Sarah Wilson", role: "Equipment Specialist" },
  ];

  const assignmentStatuses = [
    { value: "PENDING", label: "Pendiente" },
    { value: "IN_PROGRESS", label: "En Progreso" },
    { value: "COMPLETED", label: "Completado" },
    { value: "CANCELLED", label: "Cancelado" },
  ];

  useEffect(() => {
    if (assignment) {
      setFormData({
        incidentId: assignment.incidentId || "",
        assigneeIds: assignment.assigneeIds || [],
        status:
          (assignment.status?.name as
            | "PENDING"
            | "IN_PROGRESS"
            | "COMPLETED"
            | "CANCELLED") || "PENDING",
        notes: assignment.notes || "",
        startedAt: assignment.startedAt
          ? new Date(assignment.startedAt).toISOString().slice(0, 16)
          : "",
        finishedAt: assignment.finishedAt
          ? new Date(assignment.finishedAt).toISOString().slice(0, 16)
          : "",
      });
    } else if (incident) {
      setFormData((prev) => ({
        ...prev,
        incidentId: incident.id || "",
      }));
    }
  }, [assignment, incident]);

  const validateField = (field: string, value: unknown) => {
    try {
      assignmentSchema
        .pick({ [field]: true } as Record<keyof AssignmentFormData, true>)
        .parse({ [field]: value });
      setErrors((prev) => ({ ...prev, [field]: "" }));
    } catch (error: unknown) {
      const zodError = error as { issues?: ZodIssue[] };
      const fieldError = zodError.issues?.[0]?.message || "Invalid value";
      setErrors((prev) => ({ ...prev, [field]: fieldError }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate all fields
      const validatedData = assignmentSchema.parse(formData);

      // Clear any existing errors
      setErrors({});

      // Here you would make an API call to create/update the asignación
      console.log("Submitting asignación:", validatedData);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock success
      alert(
        assignment
          ? "¡Asignación actualizada exitosamente!"
          : "¡Asignación creada exitosamente!",
      );

      // Navigate back to appropriate list
      if (onClose) {
        onClose();
      } else {
        router.push("/admin/assignments");
      }
    } catch (error: unknown) {
      const zodError = error as { issues?: ZodIssue[] };
      if (zodError.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const err of zodError.issues) {
          if (err.path?.[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        }
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Mark field as touched
    setTouched((prev) => ({ ...prev, [field]: true }));

    // Validate field if it has been touched
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, formData[field as keyof AssignmentFormData]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {assignment ? "Editar Asignación" : "Crear Nueva Asignación"}
          {incident && (
            <Badge variant="outline">Incidente: {incident.title}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {incident && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Incidente Relacionado</h4>
              <div className="text-sm space-y-1">
                <div>
                  <strong>Título:</strong> {incident.title}
                </div>
                <div>
                  <strong>Prioridad:</strong> {incident.priority}
                </div>
                <div>
                  <strong>VIC:</strong> {incident.vic?.name}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assigneeIds">Asignar A *</Label>
              <SearchableSelect
                options={users.map((user) => ({
                  value: user.id,
                  label: `${user.name} - ${user.role}`,
                }))}
                value={formData.assigneeIds?.[0] || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, assigneeIds: [value] }))
                }
                placeholder="Seleccionar técnico"
                searchPlaceholder="Buscar técnicos..."
                emptyMessage="No se encontraron técnicos."
                className={errors.assigneeIds ? "border-destructive" : ""}
              />
              <FormError message={errors.assigneeIds} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger
                  className={errors.status ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {assignmentStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError message={errors.status} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              onBlur={() => handleBlur("notes")}
              placeholder="Agregar notas o instrucciones adicionales"
              rows={4}
              className={errors.notes ? "border-destructive" : ""}
            />
            <FormError message={errors.notes} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startedAt">Fecha de Inicio</Label>
              <Input
                id="startedAt"
                type="datetime-local"
                value={formData.startedAt}
                onChange={(e) => handleChange("startedAt", e.target.value)}
                onBlur={() => handleBlur("startedAt")}
                className={errors.startedAt ? "border-destructive" : ""}
              />
              <FormError message={errors.startedAt} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finishedAt">Fecha de Finalización</Label>
              <Input
                id="finishedAt"
                type="datetime-local"
                value={formData.finishedAt}
                onChange={(e) => handleChange("finishedAt", e.target.value)}
                onBlur={() => handleBlur("finishedAt")}
                disabled={formData.status !== "COMPLETED"}
                className={errors.finishedAt ? "border-destructive" : ""}
              />
              <FormError message={errors.finishedAt} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onClose ? onClose() : router.push("/admin/assignments")
              }
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {assignment ? "Actualizar Orden" : "Crear Orden"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
