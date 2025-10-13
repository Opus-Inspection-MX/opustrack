"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { FormError } from "@/components/ui/form-error"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft } from "lucide-react"

interface PermissionFormProps {
  permission?: {
    id: number
    name: string
    description?: string
    active: boolean
  }
}

export function PermissionForm({ permission }: PermissionFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    name: permission?.name || "",
    description: permission?.description || "",
    active: permission?.active ?? true,
  })

  const permissionExamples = [
    "user.create",
    "user.read",
    "user.update",
    "user.delete",
    "incident.create",
    "incident.read",
    "workorder.manage",
    "admin.access",
  ]

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Permission name is required"
    } else if (!/^[a-z]+(\.[a-z]+)*$/.test(formData.name)) {
      newErrors.name = "Permission name must be lowercase with dots (e.g., user.create)"
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = "Description must be less than 500 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log("Form data:", formData)
      router.push("/admin/permissions")
    } catch (error) {
      console.error("Error saving permission:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{permission ? "Edit Permission" : "Create Permission"}</h1>
          <p className="text-muted-foreground">
            {permission ? "Update permission information" : "Add a new permission to the system"}
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{permission ? "Edit Permission" : "Create Permission"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Permission Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., user.create"
              />
              {errors.name && <FormError message={errors.name} />}
              <p className="text-xs text-muted-foreground">
                Use dot notation to categorize permissions (e.g., user.create, incident.read)
              </p>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-2">Common examples:</p>
                <div className="flex flex-wrap gap-1">
                  {permissionExamples.map((example) => (
                    <code
                      key={example}
                      className="text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80"
                      onClick={() => handleInputChange("name", example)}
                    >
                      {example}
                    </code>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Describe what this permission allows users to do..."
                rows={3}
              />
              {errors.description && <FormError message={errors.description} />}
              <p className="text-xs text-muted-foreground">
                Optional description to help administrators understand this permission
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="active" className="text-base">
                  Active Status
                </Label>
                <p className="text-sm text-muted-foreground">
                  When disabled, this permission cannot be assigned to roles
                </p>
              </div>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleInputChange("active", checked)}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Spinner size="sm" className="mr-2" />}
                {permission ? "Update Permission" : "Create Permission"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
