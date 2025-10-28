"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, Loader2, AlertTriangle, Building } from "lucide-react";
import Link from "next/link";
import { createIncidentAsClient } from "@/lib/actions/incidents";
import { getIncidentTypes } from "@/lib/actions/lookups";
import { getMyProfile } from "@/lib/actions/users";
import { FormError } from "@/components/ui/form-error";

export default function ReportIncidentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [incidentTypes, setIncidentTypes] = useState<any[]>([]);
  const [userVic, setUserVic] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: 5,
    typeId: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [types, profile] = await Promise.all([
        getIncidentTypes(),
        getMyProfile(),
      ]);

      setIncidentTypes(types);
      setUserVic(profile?.vic || null);

      if (!profile?.vic) {
        setErrors({ general: "Debes tener un CVV asignado para reportar incidentes" });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setErrors({ general: "Error al cargar los datos del formulario" });
    } finally {
      setLoading(false);
    }
  };

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

    if (!userVic) {
      newErrors.general = "Debes tener un CVV asignado para reportar incidentes";
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
      const result = await createIncidentAsClient(
        formData.title,
        formData.description,
        formData.priority,
        formData.typeId ? parseInt(formData.typeId) : undefined
      );

      if (result.success) {
        router.push("/client");
      } else {
        throw new Error("Error al crear el incidente");
      }
    } catch (error) {
      console.error("Error reporting incident:", error);
      setErrors({
        general: error instanceof Error ? error.message : "Error al reportar el incidente. Por favor intenta de nuevo.",
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
        <Link href="/client">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Reportar un Incidente</h1>
            <p className="text-sm text-muted-foreground">Responderemos lo más pronto posible</p>
          </div>
        </div>
      </div>

      {/* VIC Info Card */}
      {userVic && (
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Reportando para CVV</p>
                <p className="font-medium">{userVic.name} ({userVic.code})</p>
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
            Por favor proporciona tantos detalles como sea posible para ayudarnos a resolver el problema rápidamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">
                  Título del Incidente <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder="Breve descripción del problema"
                  className={errors.title ? "border-red-500" : ""}
                  disabled={!userVic}
                />
                {errors.title && <FormError message={errors.title} />}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">
                  Prioridad (1-10) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="priority"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => handleChange("priority", parseInt(e.target.value))}
                  disabled={!userVic}
                />
                <p className="text-xs text-muted-foreground">
                  1=Baja, 5=Media, 8+=Alta
                </p>
              </div>
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
                disabled={!userVic}
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
                disabled={!userVic}
              >
                <SelectTrigger className={errors.typeId ? "border-red-500" : ""}>
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

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !userVic}
                className="flex-1 sm:flex-initial"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
