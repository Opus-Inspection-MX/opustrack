"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getClientesForSchedules,
  getScheduleById,
  updateSchedule,
} from "@/lib/actions/schedules";
import { fromDatetimeLocalMX, toDatetimeLocalMX } from "@/lib/utils/datetime";

interface ClienteCenter {
  id: string;
  name: string;
  code: string;
}

export default function EditSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientes, setClienteCenters] = useState<ClienteCenter[]>([]);

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    scheduledAt: string;
    endDate: string;
    clienteIds: string[];
    active: boolean;
  }>({
    title: "",
    description: "",
    scheduledAt: "",
    endDate: "",
    clienteIds: [],
    active: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [schedule, clientes] = await Promise.all([
          getScheduleById(id),
          getClientesForSchedules(),
        ]);

        if (schedule) {
          setFormData({
            title: schedule.title,
            description: schedule.description || "",
            scheduledAt: toDatetimeLocalMX(schedule.scheduledAt),
            endDate: schedule.endDate
              ? toDatetimeLocalMX(schedule.endDate)
              : "",
            clienteIds: schedule.clientes
              .filter((sv) => sv.active)
              .map((sv) => sv.clienteId),
            active: schedule.active,
          });
        }
        setClienteCenters(clientes);
      } catch (error) {
        console.error("Error fetching data:", error);
        setErrors({ submit: "Error al cargar los datos de la programación" });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (field: string, value: string | boolean | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "El título es requerido";
    } else if (formData.title.length > 200) {
      newErrors.title = "El título debe tener menos de 200 caracteres";
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description =
        "La descripción debe tener menos de 1000 caracteres";
    }

    if (!formData.scheduledAt) {
      newErrors.scheduledAt = "La fecha y hora programada es requerida";
    }

    if (formData.endDate && formData.scheduledAt) {
      const startDate = new Date(formData.scheduledAt);
      const endDate = new Date(formData.endDate);
      if (endDate <= startDate) {
        newErrors.endDate =
          "La fecha de fin debe ser posterior a la fecha de inicio";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await updateSchedule(id, {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        scheduledAt: fromDatetimeLocalMX(formData.scheduledAt) ?? new Date(),
        endDate: fromDatetimeLocalMX(formData.endDate) ?? undefined,
        clienteIds: formData.clienteIds,
      });

      router.push(`/admin/schedules/${id}`);
      router.refresh();
    } catch (error) {
      console.error("Error updating schedule:", error);
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Error al actualizar la programación. Por favor intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" text="Cargando programación..." />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback={`/admin/schedules/${id}`} label="Volver" />
        <div>
          <h1 className="text-3xl font-bold">Editar Programación</h1>
          <p className="text-muted-foreground">
            Actualizar información de la programación
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Detalles de la Programación</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && <FormError message={errors.submit} />}

            <div className="space-y-2">
              <Label htmlFor="title">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Ej. Revisión mensual de mantenimiento"
                className={errors.title ? "border-red-500" : ""}
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {formData.title.length}/200
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe la actividad programada..."
                rows={4}
                className={errors.description ? "border-red-500" : ""}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {formData.description.length}/1000
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt">
                Fecha y Hora de Inicio <span className="text-red-500">*</span>
              </Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => handleChange("scheduledAt", e.target.value)}
                className={errors.scheduledAt ? "border-red-500" : ""}
              />
              {errors.scheduledAt && (
                <p className="text-sm text-red-500">{errors.scheduledAt}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha y Hora de Fin (Opcional)</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => handleChange("endDate", e.target.value)}
                className={errors.endDate ? "border-red-500" : ""}
              />
              {errors.endDate && (
                <p className="text-sm text-red-500">{errors.endDate}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Si se proporciona, los incidentes deben crearse dentro de este
                rango de fechas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clienteIds">Clientes</Label>
              <MultiSelect
                options={clientes.map((cliente) => ({
                  value: cliente.id,
                  label: `${cliente.code} — ${cliente.name}`,
                }))}
                value={formData.clienteIds}
                onValueChange={(ids) => handleChange("clienteIds", ids)}
                placeholder="Selecciona uno o varios Clientes"
                searchPlaceholder="Buscar Cliente..."
                emptyMessage="Sin Clientes disponibles"
              />
              {errors.clienteIds && (
                <p className="text-sm text-red-500">{errors.clienteIds}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Puedes asignar la programación a varios Clientes.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleChange("active", checked)}
              />
              <Label htmlFor="active">Activo</Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/admin/schedules/${id}`)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
