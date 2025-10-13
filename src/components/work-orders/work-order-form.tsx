"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FormError } from "@/components/ui/form-error"
import { workOrderSchema, type WorkOrderFormData } from "@/lib/validations"
import { Loader2 } from "lucide-react"

interface WorkOrderFormProps {
  workOrder?: any
  incident?: any
  onClose?: () => void
}

export function WorkOrderForm({ workOrder, incident, onClose }: WorkOrderFormProps) {
  const [formData, setFormData] = useState<WorkOrderFormData>({
    incidentId: "",
    assignedToId: "",
    status: "PENDING",
    notes: "",
    startedAt: "",
    finishedAt: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const router = useRouter()

  // Mock data - replace with actual API calls
  const users = [
    { id: "user_001", name: "John Doe", role: "Technician" },
    { id: "user_002", name: "Jane Smith", role: "System Admin" },
    { id: "user_003", name: "Mike Johnson", role: "Network Specialist" },
    { id: "user_004", name: "Sarah Wilson", role: "Equipment Specialist" },
  ]

  const workOrderStatuses = [
    { value: "PENDING", label: "Pending" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
  ]

  useEffect(() => {
    if (workOrder) {
      setFormData({
        incidentId: workOrder.incidentId || "",
        assignedToId: workOrder.assignedToId || "",
        status: workOrder.status || "PENDING",
        notes: workOrder.notes || "",
        startedAt: workOrder.startedAt ? new Date(workOrder.startedAt).toISOString().slice(0, 16) : "",
        finishedAt: workOrder.finishedAt ? new Date(workOrder.finishedAt).toISOString().slice(0, 16) : "",
      })
    } else if (incident) {
      setFormData((prev) => ({
        ...prev,
        incidentId: incident.id,
      }))
    }
  }, [workOrder, incident])

  const validateField = (field: string, value: any) => {
    try {
      workOrderSchema.pick({ [field]: true } as any).parse({ [field]: value })
      setErrors((prev) => ({ ...prev, [field]: "" }))
    } catch (error: any) {
      const fieldError = error.issues?.[0]?.message || "Invalid value"
      setErrors((prev) => ({ ...prev, [field]: fieldError }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate all fields
      const validatedData = workOrderSchema.parse(formData)

      // Clear any existing errors
      setErrors({})

      // Here you would make an API call to create/update the work order
      console.log("Submitting work order:", validatedData)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mock success
      alert(workOrder ? "Work order updated successfully!" : "Work order created successfully!")

      // Navigate back to appropriate list
      if (onClose) {
        onClose()
      } else {
        router.push("/admin/work-orders")
      }
    } catch (error: any) {
      if (error.issues) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach((err: any) => {
          if (err.path?.[0]) {
            fieldErrors[err.path[0]] = err.message
          }
        })
        setErrors(fieldErrors)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Mark field as touched
    setTouched((prev) => ({ ...prev, [field]: true }))

    // Validate field if it has been touched
    if (touched[field]) {
      validateField(field, value)
    }
  }

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    validateField(field, formData[field as keyof WorkOrderFormData])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {workOrder ? "Edit Work Order" : "Create New Work Order"}
          {incident && <Badge variant="outline">Incident: {incident.title}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="assignedToId">Assign To *</Label>
              <Select value={formData.assignedToId} onValueChange={(value) => handleChange("assignedToId", value)}>
                <SelectTrigger className={errors.assignedToId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} - {user.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError message={errors.assignedToId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {workOrderStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError message={errors.status} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              onBlur={() => handleBlur("notes")}
              placeholder="Add any additional notes or instructions"
              rows={4}
              className={errors.notes ? "border-destructive" : ""}
            />
            <FormError message={errors.notes} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startedAt">Started At</Label>
              <Input
                id="startedAt"
                type="datetime-local"
                value={formData.startedAt}
                onChange={(e) => handleChange("startedAt", e.target.value)}
                onBlur={() => handleBlur("startedAt")}
                className={errors.startedAt ? "border-destructive" : ""}
              />
              <FormError message={errors.startedAt} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finishedAt">Finished At</Label>
              <Input
                id="finishedAt"
                type="datetime-local"
                value={formData.finishedAt}
                onChange={(e) => handleChange("finishedAt", e.target.value)}
                onBlur={() => handleBlur("finishedAt")}
                disabled={formData.status !== "COMPLETED"}
                className={errors.finishedAt ? "border-destructive" : ""}
              />
              <FormError message={errors.finishedAt} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => (onClose ? onClose() : router.push("/admin/work-orders"))}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {workOrder ? "Update Work Order" : "Create Work Order"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
