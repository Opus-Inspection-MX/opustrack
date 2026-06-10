"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const scheduleSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional(),
  scheduledAt: z.string().min(1, "Scheduled date and time is required"),
  clienteId: z.string().min(1, "Cliente Center is required"),
  active: z.boolean(),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

interface ClienteCenter {
  id: string;
  name: string;
  code: string;
}

interface ScheduleFormProps {
  initialData?: Partial<ScheduleFormData>;
  clientes: ClienteCenter[];
  onSubmit: (data: ScheduleFormData) => Promise<void>;
  onCancel: () => void;
}

export function ScheduleForm({
  initialData,
  clientes,
  onSubmit,
  onCancel,
}: ScheduleFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, touchedFields },
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      scheduledAt: initialData?.scheduledAt || "",
      clienteId: initialData?.clienteId || "",
      active: initialData?.active ?? true,
    },
  });

  const activeValue = watch("active");
  const descriptionValue = watch("description");
  const clienteIdValue = watch("clienteId");

  const handleFormSubmit = async (data: ScheduleFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Format datetime-local input value
  const formatDateTimeLocal = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {initialData ? "Editar Programación" : "Crear Programación"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Enter schedule title"
              className={
                errors.title && touchedFields.title ? "border-red-500" : ""
              }
            />
            {errors.title && touchedFields.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Enter schedule description"
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
                {descriptionValue?.length || 0}/1000
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Scheduled Date & Time *</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              {...register("scheduledAt")}
              defaultValue={formatDateTimeLocal(initialData?.scheduledAt || "")}
              className={
                errors.scheduledAt && touchedFields.scheduledAt
                  ? "border-red-500"
                  : ""
              }
            />
            {errors.scheduledAt && touchedFields.scheduledAt && (
              <p className="text-sm text-red-500">
                {errors.scheduledAt.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clienteId">Cliente Center *</Label>
            <SearchableSelect
              options={clientes.map((cliente) => ({
                value: cliente.id,
                label: `${cliente.code} - ${cliente.name}`,
              }))}
              value={clienteIdValue}
              onValueChange={(value) => setValue("clienteId", value)}
              placeholder="Select Cliente Center"
              searchPlaceholder="Search Cliente..."
              emptyMessage="No Cliente centers found."
              className={
                errors.clienteId && touchedFields.clienteId
                  ? "border-red-500"
                  : ""
              }
            />
            {errors.clienteId && touchedFields.clienteId && (
              <p className="text-sm text-red-500">{errors.clienteId.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={activeValue}
              onCheckedChange={(checked) => setValue("active", checked)}
            />
            <Label htmlFor="active">Active</Label>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner size="sm" />}
              {initialData ? "Actualizar Programación" : "Crear Programación"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
