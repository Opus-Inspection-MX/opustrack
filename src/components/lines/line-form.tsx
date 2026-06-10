"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
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
import { getClientes } from "@/lib/actions/clientes";
import { createLine, updateLine } from "@/lib/actions/lines";

interface LineFormProps {
  line?: {
    id: number;
    name: string;
    description?: string | null;
    clienteId: string;
  };
  mode: "create" | "edit";
}

export function LineForm({ line, mode }: LineFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientes, setClientes] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: line?.name || "",
    description: line?.description || "",
    clienteId: line?.clienteId || "",
  });

  const loadClientes = useCallback(async () => {
    try {
      const data = await getClientes();
      setClientes(data);
    } catch (error) {
      console.error("Error loading Clientes:", error);
      setErrors({ general: "Error al cargar los Cliente" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "El nombre es requerido";
    }

    if (!formData.clienteId) {
      newErrors.clienteId = "El Cliente es requerido";
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
    setErrors({});

    try {
      if (mode === "edit" && line) {
        await updateLine(line.id, {
          name: formData.name,
          description: formData.description || undefined,
          clienteId: formData.clienteId,
        });
      } else {
        await createLine({
          name: formData.name,
          description: formData.description || undefined,
          clienteId: formData.clienteId,
        });
      }

      router.push("/admin/lines");
      router.refresh();
    } catch (error) {
      console.error("Error saving line:", error);
      setErrors({
        general:
          error instanceof Error ? error.message : "Error al guardar la línea",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "edit" ? "Editar Línea" : "Nueva Línea"}
        </CardTitle>
        <CardDescription>
          {mode === "edit"
            ? "Actualiza la información de la línea"
            : "Crea una nueva línea de inspección"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.general && <FormError message={errors.general} />}

          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Línea de verificación vehicular"
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && <FormError message={errors.name} />}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Descripción de la línea..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clienteId">
              Cliente <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.clienteId}
              onValueChange={(value) => handleChange("clienteId", value)}
            >
              <SelectTrigger
                className={errors.clienteId ? "border-red-500" : ""}
              >
                <SelectValue placeholder="Seleccionar Cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((cliente) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.name} ({cliente.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clienteId && <FormError message={errors.clienteId} />}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mode === "edit" ? "Actualizar" : "Crear"} Línea
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/lines")}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
