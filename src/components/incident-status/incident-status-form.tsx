"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"
import { FormError } from "@/components/ui/form-error"
import { Spinner } from "@/components/ui/spinner"
import { z } from "zod"

const incidentStatusSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  active: z.boolean(),
})

type IncidentStatusFormData = z.infer<typeof incidentStatusSchema>

interface IncidentStatusFormProps {
  initialData?: {
    id: number
    name: string
    active: boolean
  }
  onSubmit: (data: IncidentStatusFormData) => Promise<void>
}

const getStatusColor = (name: string) => {
  const lowerName = name.toLowerCase()
  if (lowerName.includes("open") || lowerName.includes("new")) {
    return "bg-red-100 text-red-800"
  }
  if (lowerName.includes("progress") || lowerName.includes("assigned")) {
    return "bg-blue-100 text-blue-800"
  }
  if (lowerName.includes("resolved") || lowerName.includes("closed")) {
    return "bg-green-100 text-green-800"
  }
  if (lowerName.includes("pending") || lowerName.includes("waiting")) {
    return "bg-yellow-100 text-yellow-800"
  }
  return "bg-gray-100 text-gray-800"
}

export function IncidentStatusForm({ initialData, onSubmit }: IncidentStatusFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState<IncidentStatusFormData>({
    name: initialData?.name || "",
    active: initialData?.active ?? true,
  })

  const validateField = (name: keyof IncidentStatusFormData, value: any) => {
    try {
      incidentStatusSchema.shape[name].parse(value)
      setErrors((prev) => ({ ...prev, [name]: "" }))
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [name]: error.issues[0].message }))
      }
    }
  }

  const handleInputChange = (name: keyof IncidentStatusFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) {
      validateField(name, value)
    }
  }

  const handleBlur = (name: keyof IncidentStatusFormData) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    validateField(name, formData[name])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      incidentStatusSchema.parse(formData)
      setIsLoading(true)
      await onSubmit(formData)
      router.push("/admin/incident-status")
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message
          }
        })
        setErrors(fieldErrors)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const hasErrors = Object.values(errors).some((error) => error !== "")

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{initialData ? "Edit Incident Status" : "Create Incident Status"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Status Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                onBlur={() => handleBlur("name")}
                placeholder="e.g., Open, In Progress, Resolved"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && <FormError message={errors.name} />}
            </div>

            {/* Status Preview */}
            {formData.name && (
              <div className="space-y-2">
                <Label>Status Preview</Label>
                <div>
                  <Badge className={getStatusColor(formData.name)}>{formData.name}</Badge>
                </div>
              </div>
            )}

            {/* Active Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleInputChange("active", checked)}
              />
              <Label htmlFor="active">Active Status</Label>
            </div>

            {/* Error Summary */}
            {hasErrors && (
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Please fix the following errors:</span>
                </div>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {Object.entries(errors).map(([field, error]) => error && <li key={field}>{error}</li>)}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading || hasErrors} className="flex items-center gap-2">
                {isLoading && <Spinner size="sm" />}
                {isLoading ? "Saving..." : initialData ? "Update Status" : "Create Status"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/incident-status")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
