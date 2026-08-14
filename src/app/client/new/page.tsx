"use client";

import { AlertTriangle, Building, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
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
import { toast } from "@/hooks/use-toast";
import { getEquipmentsByLineId } from "@/lib/actions/equipments";
import { createIncidentAsClient } from "@/lib/actions/incidents";
import { getLinesByClienteId } from "@/lib/actions/lines";
import { getIncidentTypes } from "@/lib/actions/lookups";
import { isFailure } from "@/lib/actions/result";
import { getMyProfile } from "@/lib/actions/users";

interface IncidentType {
  id: number;
  name: string;
}

interface Cliente {
  id: string;
  name: string;
  code: string;
}

interface Line {
  id: number;
  name: string;
}

interface Equipment {
  id: number;
  name: string;
}

export default function ReportIncidentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [userCliente, setUserCliente] = useState<Cliente | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reporterName: "",
    priority: 5,
    typeId: "",
    lineId: "",
    equipmentId: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [types, profile] = await Promise.all([
        getIncidentTypes(),
        getMyProfile(),
      ]);

      setIncidentTypes(types.data);
      setUserCliente(profile?.cliente || null);

      if (!profile?.cliente) {
        setErrors({
          general: "Debes tener un Cliente asignado para reportar incidentes",
        });
      } else {
        // Load lines for the user's Cliente
        const clienteLines = await getLinesByClienteId(profile.cliente.id);
        setLines(clienteLines);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setErrors({ general: "Error al cargar los datos del formulario" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load equipments when line is selected
  useEffect(() => {
    const loadEquipments = async () => {
      if (formData.lineId) {
        try {
          const lineEquipments = await getEquipmentsByLineId(
            parseInt(formData.lineId, 10),
          );
          setEquipments(lineEquipments);
        } catch (error) {
          console.error("Error loading equipments:", error);
        }
      } else {
        setEquipments([]);
        setFormData((prev) => ({ ...prev, equipmentId: "" }));
      }
    };
    loadEquipments();
  }, [formData.lineId]);

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "El título es requerido";
    }

    if (!formData.description.trim()) {
      newErrors.description = "La descripción es requerida";
    }

    if (!formData.typeId) {
      newErrors.typeId = "El tipo de incidente es requerido";
    }

    if (!userCliente) {
      newErrors.general =
        "Debes tener un Cliente asignado para reportar incidentes";
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
      const result = await createIncidentAsClient({
        title: formData.title,
        description: formData.description,
        reporterName: formData.reporterName || undefined,
        priority: formData.priority,
        typeId: formData.typeId ? parseInt(formData.typeId, 10) : undefined,
        lineId: formData.lineId ? parseInt(formData.lineId, 10) : undefined,
        equipmentId: formData.equipmentId
          ? parseInt(formData.equipmentId, 10)
          : undefined,
      });

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }

      if (result.success) {
        router.push("/client");
      } else {
        throw new Error("Error al crear el incidente");
      }
    } catch (error) {
      console.error("Error reporting incident:", error);
      setErrors({
        general:
          error instanceof Error
            ? error.message
            : "Error al reportar el incidente. Por favor intenta de nuevo.",
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
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <BackButton fallback="/client" label="Volver" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Reportar un Incidente
            </h1>
            <p className="text-sm text-muted-foreground">
              Responderemos lo más pronto posible
            </p>
          </div>
        </div>
      </div>

      {/* Cliente Info Card */}
      {userCliente && (
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Reportando para Cliente
                </p>
                <p className="font-medium">
                  {userCliente.name} ({userCliente.code})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errors.general && <FormError message={errors.general} />}

      <Card>
        <CardHeader>
          <CardTitle>Detalles del Incidente</CardTitle>
          <CardDescription>
            Por favor proporciona tantos detalles como sea posible para
            ayudarnos a resolver el problema rápidamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Título del Incidente <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Breve descripción del problema"
                className={errors.title ? "border-red-500" : ""}
                disabled={!userCliente}
              />
              {errors.title && <FormError message={errors.title} />}
            </div>

            {/* Who is reporting — the account belongs to the whole center, so
                this is the only way to know which person raised it. */}
            <div className="space-y-2">
              <Label htmlFor="reporterName">¿Quién reporta?</Label>
              <Input
                id="reporterName"
                value={formData.reporterName}
                onChange={(e) => handleChange("reporterName", e.target.value)}
                placeholder="Nombre de la persona que reporta"
                maxLength={120}
                disabled={!userCliente}
              />
              <p className="text-xs text-muted-foreground">
                Esta cuenta es del centro. Escribe tu nombre para que el
                administrador y el técnico sepan con quién dar seguimiento.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Descripción <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Proporciona información detallada sobre el incidente..."
                rows={5}
                className={errors.description ? "border-red-500" : ""}
                disabled={!userCliente}
              />
              {errors.description && <FormError message={errors.description} />}
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="typeId">
                Tipo de Incidente <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.typeId}
                onValueChange={(value) => handleChange("typeId", value)}
                disabled={!userCliente}
              >
                <SelectTrigger
                  className={errors.typeId ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Selecciona el tipo de incidente" />
                </SelectTrigger>
                <SelectContent>
                  {incidentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.typeId && <FormError message={errors.typeId} />}
            </div>

            {/* Line */}
            <div className="space-y-2">
              <Label htmlFor="lineId">Línea (Opcional)</Label>
              <Select
                value={formData.lineId}
                onValueChange={(value) => handleChange("lineId", value)}
                disabled={!userCliente || lines.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      lines.length === 0
                        ? "No hay líneas disponibles"
                        : "Selecciona una línea"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id.toString()}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecciona la línea donde ocurrió el incidente
              </p>
            </div>

            {/* Equipment */}
            <div className="space-y-2">
              <Label htmlFor="equipmentId">Equipo (Opcional)</Label>
              <Select
                value={formData.equipmentId}
                onValueChange={(value) => handleChange("equipmentId", value)}
                disabled={!formData.lineId || equipments.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !formData.lineId
                        ? "Primero selecciona una línea"
                        : equipments.length === 0
                          ? "No hay equipos disponibles"
                          : "Selecciona un equipo"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {equipments.map((equipment) => (
                    <SelectItem
                      key={equipment.id}
                      value={equipment.id.toString()}
                    >
                      {equipment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecciona el equipo específico relacionado con el incidente
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !userCliente}
                className="flex-1 sm:flex-initial"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? "Enviando..." : "Enviar Reporte"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/client")}
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
