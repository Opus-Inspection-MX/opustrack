"use client";

import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
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
  createSchedule,
  getClientesForSchedules,
} from "@/lib/actions/schedules";

interface ClienteCenter {
  id: string;
  name: string;
  code: string;
}

export default function NewSchedulePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
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
    const fetchClientes = async () => {
      try {
        setIsLoading(true);
        const clientes = await getClientesForSchedules();
        setClienteCenters(clientes);
      } catch (error) {
        console.error("Error fetching Cliente centers:", error);
        setErrors({ submit: "Error al cargar los centros Cliente" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientes();
  }, []);

  const handleChange = (field: string, value: string | boolean | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 200) {
      newErrors.title = "Title must be less than 200 characters";
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description = "Description must be less than 1000 characters";
    }

    if (!formData.scheduledAt) {
      newErrors.scheduledAt = "Scheduled date and time is required";
    }

    // Validate endDate is after scheduledAt if provided
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
      await createSchedule({
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        scheduledAt: new Date(formData.scheduledAt),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        clienteIds: formData.clienteIds,
      });

      router.push("/admin/schedules");
      router.refresh();
    } catch (error) {
      console.error("Error creating schedule:", error);
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Error al crear la programación. Por favor intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" text="Cargando..." />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/schedules">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Crear Nueva Programación</h1>
          <p className="text-muted-foreground">
            Programa una actividad de mantenimiento o inspección
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
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="e.g., Monthly Maintenance Check"
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe the scheduled activity..."
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
                Start Date & Time <span className="text-red-500">*</span>
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
              <Label htmlFor="endDate">End Date & Time (Optional)</Label>
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
                If provided, incidents must be created within this date range
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
              <Label htmlFor="active">Active</Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Creando..." : "Crear Programación"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/schedules")}
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
