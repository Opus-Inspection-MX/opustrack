"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"

const incidentTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  active: z.boolean(),
})

type IncidentTypeFormData = z.infer<typeof incidentTypeSchema>

interface IncidentTypeFormProps {
  initialData?: Partial<IncidentTypeFormData>
  onSubmit: (data: IncidentTypeFormData) => Promise<void>
  onCancel: () => void
}

export function IncidentTypeForm({ initialData, onSubmit, onCancel }: IncidentTypeFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    },
  })

  const activeValue = watch("active")
  const descriptionValue = watch("description")

  const handleFormSubmit = async (data: IncidentTypeFormData) => {
    try {
      setIsLoading(true)
      setError(null)
      await onSubmit(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{initialData ? "Edit Incident Type" : "Create Incident Type"}</CardTitle>
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
              className={errors.name && touchedFields.name ? "border-red-500" : ""}
            />
            {errors.name && touchedFields.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Enter incident type description"
              rows={3}
              className={errors.description && touchedFields.description ? "border-red-500" : ""}
            />
            <div className="flex justify-between">
              {errors.description && touchedFields.description && (
                <p className="text-sm text-red-500">{errors.description.message}</p>
              )}
              <p className="text-sm text-muted-foreground ml-auto">{descriptionValue?.length || 0}/500</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="active" checked={activeValue} onCheckedChange={(checked) => setValue("active", checked)} />
            <Label htmlFor="active">Active</Label>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner size="sm" />}
              {initialData ? "Update Type" : "Create Type"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
