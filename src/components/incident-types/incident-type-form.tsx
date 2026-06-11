"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type IncidentTypeFormData,
  incidentTypeSchema,
} from "@/lib/validations/incident-types";

interface IncidentTypeFormProps {
  initialData?: Partial<IncidentTypeFormData & { id: number }>;
  onSubmit: (data: IncidentTypeFormData) => Promise<void>;
  redirectPath: string;
  title?: string;
  isEdit?: boolean;
}

export function IncidentTypeForm({
  initialData,
  onSubmit,
  redirectPath,
  title = "Incident Type Details",
  isEdit = false,
}: IncidentTypeFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, touchedFields },
  } = useForm<IncidentTypeFormData>({
    resolver: zodResolver(incidentTypeSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      active: initialData?.active ?? true,
      priority: initialData?.priority ?? 5,
    },
  });

  const activeValue = watch("active");
  const descriptionValue = watch("description");

  const handleFormSubmit = async (data: IncidentTypeFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      await onSubmit(data);
      router.push(redirectPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Enter incident type name"
              className={
                errors.name && touchedFields.name ? "border-red-500" : ""
              }
            />
            {errors.name && touchedFields.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Enter incident type description"
              rows={3}
              className={
                errors.description && touchedFields.description
                  ? "border-red-500"
                  : ""
              }
            />
            <div className="flex justify-between">
              {errors.description && touchedFields.description && (
                <p className="text-sm text-red-500">
                  {errors.description.message}
                </p>
              )}
              <p className="text-sm text-muted-foreground ml-auto">
                {descriptionValue?.length || 0}/500
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridad *</Label>
            <Input
              id="priority"
              type="number"
              min={1}
              max={10}
              step={1}
              {...register("priority", { valueAsNumber: true })}
              className={
                errors.priority && touchedFields.priority
                  ? "border-red-500"
                  : ""
              }
            />
            {errors.priority && touchedFields.priority && (
              <p className="text-sm text-red-500">{errors.priority.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              1 (lowest) – 10 (highest). Values ≥ 8 are flagged as critical.
            </p>
          </div>

          {isEdit && (
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={activeValue}
                onCheckedChange={(checked) => setValue("active", checked)}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner size="sm" />}
              {isEdit ? "Update Type" : "Create Type"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
