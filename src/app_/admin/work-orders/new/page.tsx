"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"

const mockUsers = [
  { id: "user_001", name: "John Doe", role: "Technician" },
  { id: "user_002", name: "Jane Smith", role: "System Admin" },
  { id: "user_003", name: "Mike Johnson", role: "Network Specialist" },
]

export default function NewWorkOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const incidentId = searchParams.get("incidentId")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [incident, setIncident] = useState<any>(null)

  const [formData, setFormData] = useState({
    incidentId: incidentId || "",
    assignedToId: "",
    status: "PENDING",
    notes: "",
    startedAt: "",
    finishedAt: "",
  })

  useEffect(() => {
    if (incidentId) {
      // Fetch incident details
      const mockIncident = {
        id: incidentId,
        title: "Equipment Malfunction",
        priority: "HIGH",
        vic: { name: "VIC Centro" },
      }
      setIncident(mockIncident)
    }
  }, [incidentId])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.incidentId) {
      newErrors.incidentId = "Incident is required"
    }

    if (!formData.assignedToId) {
      newErrors.assignedToId = "Assigned technician is required"
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
      console.log("Creating work order:", formData)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      alert("Work order created successfully!")
      router.push("/admin/work-orders")
    } catch (error) {
      console.error("Error creating work order:", error)
      alert("Failed to create work order")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/work-orders">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create New Work Order</h1>
          <p className="text-muted-foreground">Assign work to resolve an incident</p>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Work Order Details
            {incident && <Badge variant="outline">Incident: {incident.title}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {incident && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Related Incident</h4>
                <div className="text-sm space-y-1">
                  <div>
                    <strong>Title:</strong> {incident.title}
                  </div>
                  <div>
                    <strong>Priority:</strong> {incident.priority}
                  </div>
                  <div>
                    <strong>VIC:</strong> {incident.vic?.name}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignedToId">
                  Assign To <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.assignedToId} onValueChange={(value) => handleChange("assignedToId", value)}>
                  <SelectTrigger className={errors.assignedToId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} - {user.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assignedToId && <p className="text-sm text-red-500">{errors.assignedToId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Add any additional notes or instructions"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startedAt">Started At</Label>
                <Input
                  id="startedAt"
                  type="datetime-local"
                  value={formData.startedAt}
                  onChange={(e) => handleChange("startedAt", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finishedAt">Finished At</Label>
                <Input
                  id="finishedAt"
                  type="datetime-local"
                  value={formData.finishedAt}
                  onChange={(e) => handleChange("finishedAt", e.target.value)}
                  disabled={formData.status !== "COMPLETED"}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Creating..." : "Create Work Order"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/work-orders")}
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
