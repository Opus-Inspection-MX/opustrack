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
import { createEquipment, updateEquipment } from "@/lib/actions/equipments";
import { getLinesByVicId } from "@/lib/actions/lines";
import { getVICs } from "@/lib/actions/vics";

interface EquipmentFormProps {
  equipment?: {
    id: number;
    name: string;
    description?: string | null;
    lineId: number;
    line?: {
      vicId: string;
    };
  };
  mode: "create" | "edit";
}

interface VIC {
  id: string;
  name: string;
  code: string;
}

interface Line {
  id: number;
  name: string;
}

export function EquipmentForm({ equipment, mode }: EquipmentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vics, setVics] = useState<VIC[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);

  const [formData, setFormData] = useState({
    name: equipment?.name || "",
    description: equipment?.description || "",
    vicId: equipment?.line?.vicId || "",
    lineId: equipment?.lineId?.toString() || "",
  });

  const loadVics = useCallback(async () => {
    try {
      const data = await getVICs();
      setVics(data);
    } catch (error) {
      console.error("Error loading VICs:", error);
      setErrors({ general: "Error al cargar los CVV" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLinesByVic = useCallback(async (vicId: string) => {
    setLoadingLines(true);
    try {
      const data = await getLinesByVicId(vicId);
      setLines(data);
    } catch (error) {
      console.error("Error loading lines:", error);
      setErrors({ general: "Error al cargar las líneas" });
    } finally {
      setLoadingLines(false);
    }
  }, []);

  useEffect(() => {
    loadVics();
  }, [loadVics]);

  useEffect(() => {
    if (formData.vicId) {
      loadLinesByVic(formData.vicId);
    } else {
      setLines([]);
    }
  }, [formData.vicId, loadLinesByVic]);

  const handleChange = (field: string, value: string) => {
    // If VIC changes, reset line selection
    if (field === "vicId") {
      setFormData((prev) => ({ ...prev, [field]: value, lineId: "" }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "El nombre es requerido";
    }

    if (!formData.vicId) {
      newErrors.vicId = "El CVV es requerido";
    }

    if (!formData.lineId) {
      newErrors.lineId = "La línea es requerida";
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
      if (mode === "edit" && equipment) {
        await updateEquipment(equipment.id, {
          name: formData.name,
          description: formData.description || undefined,
          lineId: parseInt(formData.lineId, 10),
        });
      } else {
        await createEquipment({
          name: formData.name,
          description: formData.description || undefined,
          lineId: parseInt(formData.lineId, 10),
        });
      }

      router.push("/admin/equipments");
      router.refresh();
    } catch (error) {
      console.error("Error saving equipment:", error);
      setErrors({
        general:
          error instanceof Error ? error.message : "Error al guardar el equipo",
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
          {mode === "edit" ? "Editar Equipo" : "Nuevo Equipo"}
        </CardTitle>
        <CardDescription>
          {mode === "edit"
            ? "Actualiza la información del equipo"
            : "Crea un nuevo equipo para una línea"}
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
              placeholder="Equipo de medición de gases"
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
              placeholder="Descripción del equipo..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vicId">
              CVV <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.vicId}
              onValueChange={(value) => handleChange("vicId", value)}
            >
              <SelectTrigger className={errors.vicId ? "border-red-500" : ""}>
                <SelectValue placeholder="Seleccionar CVV" />
              </SelectTrigger>
              <SelectContent>
                {vics.map((vic) => (
                  <SelectItem key={vic.id} value={vic.id}>
                    {vic.name} ({vic.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.vicId && <FormError message={errors.vicId} />}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lineId">
              Línea <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.lineId}
              onValueChange={(value) => handleChange("lineId", value)}
              disabled={!formData.vicId || loadingLines}
            >
              <SelectTrigger className={errors.lineId ? "border-red-500" : ""}>
                <SelectValue
                  placeholder={
                    !formData.vicId
                      ? "Primero selecciona un CVV"
                      : loadingLines
                        ? "Cargando líneas..."
                        : "Seleccionar Línea"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {lines.length === 0 && formData.vicId && !loadingLines ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No hay líneas disponibles para este CVV
                  </div>
                ) : (
                  lines.map((line) => (
                    <SelectItem key={line.id} value={line.id.toString()}>
                      {line.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.lineId && <FormError message={errors.lineId} />}
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
              {mode === "edit" ? "Actualizar" : "Crear"} Equipo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/equipments")}
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
