"use client";

import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  getAssignmentActivityById,
  updateAssignmentActivity,
} from "@/lib/actions/assignment-activities";

export default function EditAssignmentActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    description: "",
    performedAt: "",
  });

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const activity = await getAssignmentActivityById(id);
        if (activity) {
          setFormData({
            description: activity.description,
            performedAt: new Date(activity.performedAt)
              .toISOString()
              .slice(0, 16),
          });
        }
      } catch (error) {
        console.error("Error fetching work activity:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      // Validation
      const newErrors: Record<string, string> = {};

      if (!formData.description.trim()) {
        newErrors.description = "La descripción es requerida";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      const result = await updateAssignmentActivity(id, {
        description: formData.description,
        performedAt: new Date(formData.performedAt),
      });

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }

      if (result.success) {
        router.push(`/admin/assignment-activities/${id}`);
      }
    } catch (error) {
      console.error("Error updating work activity:", error);
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Error al actualizar la actividad. Por favor intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando actividad de trabajo..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Actividad de Trabajo</h1>
          <p className="text-muted-foreground">
            Actualizar información de la actividad de trabajo
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la Actividad de Trabajo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && <FormError message={errors.submit} />}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Descripción <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (errors.description) {
                    setErrors({ ...errors, description: "" });
                  }
                }}
                placeholder="Describe el trabajo realizado"
                rows={4}
              />
              {errors.description && <FormError message={errors.description} />}
            </div>

            {/* Realizada El */}
            <div className="space-y-2">
              <Label htmlFor="performedAt">Realizada El</Label>
              <Input
                id="performedAt"
                type="datetime-local"
                value={formData.performedAt}
                onChange={(e) =>
                  setFormData({ ...formData, performedAt: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span>Actualizando...</span>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Actualizar Actividad
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
