"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

export default function EditIncidentTypePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [incidentTypeId, setIncidentTypeId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    active: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    params.then((p) => setIncidentTypeId(parseInt(p.id)))
  }, [params])

  useEffect(() => {
    if (incidentTypeId) {
      fetchIncidentType()
    }
  }, [incidentTypeId])

  const fetchIncidentType = async () => {
    if (!incidentTypeId) return

    try {
      setIsFetching(true)
      const { getIncidentTypeById } = await import("@/lib/actions/lookups")
      const data = await getIncidentTypeById(incidentTypeId)

      if (data) {
        setFormData({
          name: data.name,
          description: data.description || "",
          active: data.active,
        })
      }
    } catch (error) {
      console.error("Error fetching incident type:", error)
    } finally {
      setIsFetching(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    } else if (formData.name.length > 100) {
      newErrors.name = "Name must be less than 100 characters"
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = "Description must be less than 500 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !incidentTypeId) {
      return
    }

    try {
      setIsLoading(true)
      const { updateIncidentType } = await import("@/lib/actions/lookups")
      await updateIncidentType(incidentTypeId, {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        active: formData.active,
      })
      router.push(`/admin/incident-types/${incidentTypeId}`)
      router.refresh()
    } catch (error) {
      console.error("Error updating incident type:", error)
      alert("Failed to update incident type")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" text="Loading incident type..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Incident Type</h1>
          <p className="text-muted-foreground">Update incident type information</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Incident Type Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Hardware Failure, Software Bug"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Enter a detailed description of this incident type"
                rows={4}
                className={errors.description ? "border-red-500" : ""}
              />
              <div className="flex justify-between">
                {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
                <p className="text-sm text-muted-foreground ml-auto">{formData.description.length}/500</p>
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

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Spinner size="sm" />}
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push(`/admin/incident-types/${incidentTypeId}`)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
