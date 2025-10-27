"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormError } from "@/components/ui/form-error"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft } from "lucide-react"

interface UserStatusFormProps {
  initialData?: {
    id: number
    name: string
    active: boolean
  }
}

export function UserStatusForm({ initialData }: UserStatusFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    active: initialData?.active ?? true,
  })

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    } else if (formData.name.length > 50) {
      newErrors.name = "Name must be less than 50 characters"
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
      const { createUserStatus, updateUserStatus } = await import("@/lib/actions/lookups")

      if (initialData) {
        await updateUserStatus(initialData.id, {
          name: formData.name.trim(),
          active: formData.active,
        })
      } else {
        await createUserStatus({
          name: formData.name.trim(),
        })
      }

      router.push("/admin/user-status")
      router.refresh()
    } catch (error) {
      console.error("Error saving user status:", error)
      setErrors({ submit: "Failed to save user status. Please try again." })
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
          <h1 className="text-3xl font-bold">{initialData ? "Edit User Status" : "Create User Status"}</h1>
          <p className="text-muted-foreground">
            {initialData ? "Update user status information" : "Add a new user status"}
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{initialData ? "Edit User Status" : "Create User Status"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && <FormError message={errors.submit} />}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter status name (e.g., Active, Inactive)"
              />
              {errors.name && <FormError message={errors.name} />}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleInputChange("active", checked)}
              />
              <Label htmlFor="active">Active</Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Spinner size="sm" className="mr-2" />}
                {initialData ? "Update Status" : "Create Status"}
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
