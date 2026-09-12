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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getClientsForSelect } from "@/lib/actions/clients";
import {
  createEquipment,
  getEquipmentStatusOptions,
  updateEquipment,
} from "@/lib/actions/equipments";
import { getLinesByClientId } from "@/lib/actions/lines";
import { logger } from "@/lib/observability/logger";

interface EquipmentFormProps {
  equipment?: {
    id: number;
    name: string;
    description?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    statusId?: number;
    lineId: number;
    line?: {
      clientId: string;
    };
  };
  mode: "create" | "edit";
}

interface Client {
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
  const [clients, setClients] = useState<Client[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [statuses, setStatuses] = useState<Array<{ id: number; name: string }>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);

  const [formData, setFormData] = useState({
    name: equipment?.name || "",
    description: equipment?.description || "",
    model: equipment?.model || "",
    serialNumber: equipment?.serialNumber || "",
    statusId: equipment?.statusId?.toString() || "",
    clientId: equipment?.line?.clientId || "",
    lineId: equipment?.lineId?.toString() || "",
  });

  const loadClients = useCallback(async () => {
    try {
      const [clientRows, statusRows] = await Promise.all([
        getClientsForSelect(),
        getEquipmentStatusOptions(),
      ]);
      setClients(clientRows);
      setStatuses(statusRows);
    } catch (error) {
      logger.error("Error loading Clientes:", error);
      setErrors({ general: "Error al cargar los Cliente" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLinesByClient = useCallback(async (clientId: string) => {
    setLoadingLines(true);
    try {
      const data = await getLinesByClientId(clientId);
      setLines(data);
    } catch (error) {
      logger.error("Error loading lines:", error);
      setErrors({ general: "Error al cargar las líneas" });
    } finally {
      setLoadingLines(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (formData.clientId) {
      loadLinesByClient(formData.clientId);
    } else {
      setLines([]);
    }
  }, [formData.clientId, loadLinesByClient]);

  const handleChange = (field: string, value: string) => {
    // If Client changes, reset line selection
    if (field === "clientId") {
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

    if (!formData.clientId) {
      newErrors.clientId = "El Cliente es requerido";
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
          model: formData.model || null,
          serialNumber: formData.serialNumber || null,
          ...(formData.statusId
            ? { statusId: parseInt(formData.statusId, 10) }
            : {}),
        });
      } else {
        await createEquipment({
          name: formData.name,
          description: formData.description || undefined,
          lineId: parseInt(formData.lineId, 10),
          model: formData.model || undefined,
          serialNumber: formData.serialNumber || undefined,
          ...(formData.statusId
            ? { statusId: parseInt(formData.statusId, 10) }
            : {}),
        });
      }

      router.push("/admin/equipments");
      router.refresh();
    } catch (error) {
      logger.error("Error saving equipment:", error);
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleChange("model", e.target.value)}
                placeholder="Modelo del fabricante"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialNumber">Número de serie</Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => handleChange("serialNumber", e.target.value)}
                placeholder="N/S del equipo"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="statusId">Estado del equipo</Label>
            <Select
              value={formData.statusId}
              onValueChange={(value) => handleChange("statusId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status.id} value={status.id.toString()}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">
              Client <span className="text-red-500">*</span>
            </Label>
            <SearchableSelect
              options={clients.map((client) => ({
                value: client.id,
                label: `${client.name} (${client.code})`,
              }))}
              value={formData.clientId}
              onValueChange={(value) => handleChange("clientId", value)}
              placeholder="Seleccionar Cliente"
              searchPlaceholder="Buscar Cliente..."
              emptyMessage="No se encontraron Cliente."
              className={errors.clientId ? "border-red-500" : ""}
            />
            {errors.clientId && <FormError message={errors.clientId} />}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lineId">
              Línea <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.lineId}
              onValueChange={(value) => handleChange("lineId", value)}
              disabled={!formData.clientId || loadingLines}
            >
              <SelectTrigger className={errors.lineId ? "border-red-500" : ""}>
                <SelectValue
                  placeholder={
                    !formData.clientId
                      ? "Primero selecciona un Cliente"
                      : loadingLines
                        ? "Cargando líneas..."
                        : "Seleccionar Línea"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {lines.length === 0 && formData.clientId && !loadingLines ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No hay líneas disponibles para este Cliente
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
