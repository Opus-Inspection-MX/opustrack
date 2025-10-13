"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormError } from "@/components/ui/form-error"
import { Spinner } from "@/components/ui/spinner"
import { AlertCircle } from "lucide-react"

const stateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Name can only contain letters and spaces"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(10, "Code must be less than 10 characters")
    .regex(/^[A-Z0-9]+$/, "Code must be uppercase letters and numbers only"),
  active: z.boolean(),
})

type StateFormData = z.infer<typeof stateSchema>

interface StateFormProps {
  initialData?: Partial<StateFormData> & { id?: number }
  isEditing?: boolean
}

export function StateForm({ initialData, isEditing = false }: StateFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState<StateFormData>({
    name: initialData?.name || "",
    code: initialData?.code || "",
    active: initialData?.active ?? true,
  })

  const validateField = (name: keyof StateFormData, value: any) => {
    try {
      stateSchema.pick({ [name]: true }).parse({ [name]: value })
      setErrors((prev) => ({ ...prev, [name]: "" }))
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [name]: error.issues[0]?.message || "" }))
      }
    }
  }

  const handleInputChange = (name: keyof StateFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) {
      validateField(name, value)
    }
  }

  const handleBlur = (name: keyof StateFormData) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    validateField(name, formData[name])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const validatedData = stateSchema.parse(formData)
      setIsLoading(true)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      console.log(isEditing ? "Update state:" : "Create state:", validatedData)

      router.push("/admin/states")
      router.refresh()
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
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit State" : "Create New State"}</CardTitle>
        <CardDescription>{isEditing ? "Update state information" : "Add a new state to the system"}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">State Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                onBlur={() => handleBlur("name")}
                placeholder="e.g., Ciudad de México"
                className={errors.name ? "border-red-500" : ""}
              />
              <FormError message={errors.name} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">State Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => handleInputChange("code", e.target.value.toUpperCase())}
                onBlur={() => handleBlur("code")}
                placeholder="e.g., CDMX"
                className={errors.code ? "border-red-500" : ""}
              />
              <FormError message={errors.code} />
              <p className="text-xs text-muted-foreground">Uppercase letters and numbers only</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => handleInputChange("active", checked)}
            />
            <Label htmlFor="active">Active</Label>
          </div>

          {hasErrors && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">Please fix the errors above before submitting.</span>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isLoading || hasErrors} className="flex-1">
              {isLoading ? (
                <>
                  <Spinner size="sm" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update State"
              ) : (
                "Create State"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
