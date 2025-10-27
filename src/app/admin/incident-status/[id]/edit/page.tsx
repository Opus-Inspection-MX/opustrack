"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

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

export default function EditIncidentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [statusId, setStatusId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [formData, setFormData] = useState({
    name: "",
    active: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    params.then((p) => setStatusId(parseInt(p.id)))
  }, [params])

  useEffect(() => {
    if (statusId) {
      fetchIncidentStatus()
    }
  }, [statusId])

  const fetchIncidentStatus = async () => {
    if (!statusId) return

    try {
      setIsFetching(true)
      const { getIncidentStatusById } = await import("@/lib/actions/lookups")
      const data = await getIncidentStatusById(statusId)

      if (data) {
        setFormData({
          name: data.name,
          active: data.active,
        })
      }
    } catch (error) {
      console.error("Error fetching incident status:", error)
    } finally {
      setIsFetching(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    } else if (formData.name.length < 2) {
      newErrors.name = "Name must be at least 2 characters"
    } else if (formData.name.length > 50) {
      newErrors.name = "Name must be less than 50 characters"
    } else if (!/^[a-zA-Z\s]+$/.test(formData.name)) {
      newErrors.name = "Name can only contain letters and spaces"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !statusId) {
      return
    }

    try {
      setIsLoading(true)
      const { updateIncidentStatus } = await import("@/lib/actions/lookups")
      await updateIncidentStatus(statusId, {
        name: formData.name.trim(),
        active: formData.active,
      })
      router.push(`/admin/incident-status/${statusId}`)
      router.refresh()
    } catch (error) {
      console.error("Error updating incident status:", error)
      alert("Failed to update incident status")
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
        <Spinner size="lg" text="Loading incident status..." />
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
          <h1 className="text-3xl font-bold">Edit Incident Status</h1>
          <p className="text-muted-foreground">Update incident status information</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Incident Status Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Status Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Open, In Progress, Resolved"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            {formData.name && (
              <div className="space-y-2">
                <Label>Status Preview</Label>
                <div>
                  <Badge className={getStatusColor(formData.name)}>{formData.name}</Badge>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleInputChange("active", checked)}
              />
              <Label htmlFor="active">Active Status</Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Spinner size="sm" />}
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/admin/incident-status/${statusId}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
