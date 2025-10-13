"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"

const mockIncidentTypes = [
  { id: "1", name: "Technical" },
  { id: "2", name: "System" },
  { id: "3", name: "Equipment" },
  { id: "4", name: "Network" },
]

const mockIncidentStatuses = [
  { id: "1", name: "Open" },
  { id: "2", name: "In Progress" },
  { id: "3", name: "Resolved" },
  { id: "4", name: "Closed" },
]

const mockVics = [
  { id: "vic_001", name: "VIC Centro", code: "VIC001" },
  { id: "vic_002", name: "VIC Norte", code: "VIC002" },
  { id: "vic_003", name: "VIC Sur", code: "VIC003" },
]

const mockUsers = [
  { id: "user_001", name: "John Doe" },
  { id: "user_002", name: "Jane Smith" },
  { id: "user_003", name: "Mike Johnson" },
]

export default function NewIncidentPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    sla: 24,
    typeId: "",
    statusId: "",
    vicId: "",
    reportedById: "",
  })

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = "Title is required"
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required"
    }

    if (!formData.typeId) {
      newErrors.typeId = "Incident type is required"
    }

    if (!formData.statusId) {
      newErrors.statusId = "Status is required"
    }

    if (!formData.vicId) {
      newErrors.vicId = "VIC is required"
    }

    if (!formData.reportedById) {
      newErrors.reportedById = "Reporter is required"
    }

    if (formData.sla < 1 || formData.sla > 8760) {
      newErrors.sla = "SLA must be between 1 and 8760 hours"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      console.log("Creating incident:", formData)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      alert("Incident created successfully!")
      router.push("/admin/incidents")
    } catch (error) {
      console.error("Error creating incident:", error)
      alert("Failed to create incident")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/incidents">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create New Incident</h1>
          <p className="text-muted-foreground">Fill in the details to create a new incident</p>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Incident Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder="Enter incident title"
                  className={errors.title ? "border-red-500" : ""}
                />
                {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">
                  Priority <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.priority} onValueChange={(value) => handleChange("priority", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe the incident in detail"
                rows={4}
                className={errors.description ? "border-red-500" : ""}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="typeId">
                  Incident Type <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.typeId} onValueChange={(value) => handleChange("typeId", value)}>
                  <SelectTrigger className={errors.typeId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockIncidentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.typeId && <p className="text-sm text-red-500">{errors.typeId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="statusId">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.statusId} onValueChange={(value) => handleChange("statusId", value)}>
                  <SelectTrigger className={errors.statusId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockIncidentStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.statusId && <p className="text-sm text-red-500">{errors.statusId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sla">
                  SLA (hours) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sla"
                  type="number"
                  value={formData.sla}
                  onChange={(e) => handleChange("sla", Number.parseInt(e.target.value) || 0)}
                  placeholder="24"
                  min="1"
                  max="8760"
                  className={errors.sla ? "border-red-500" : ""}
                />
                {errors.sla && <p className="text-sm text-red-500">{errors.sla}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vicId">
                  VIC <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.vicId} onValueChange={(value) => handleChange("vicId", value)}>
                  <SelectTrigger className={errors.vicId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select VIC" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockVics.map((vic) => (
                      <SelectItem key={vic.id} value={vic.id}>
                        {vic.name} ({vic.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.vicId && <p className="text-sm text-red-500">{errors.vicId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportedById">
                  Reported By <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.reportedById} onValueChange={(value) => handleChange("reportedById", value)}>
                  <SelectTrigger className={errors.reportedById ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select reporter" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.reportedById && <p className="text-sm text-red-500">{errors.reportedById}</p>}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Creating..." : "Create Incident"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/incidents")}
                disabled={isSubmitting}
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
