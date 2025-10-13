"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

interface IncidentFormProps {
  incident?: any
  onClose?: () => void
}

export function IncidentForm({ incident, onClose }: IncidentFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    sla: 24,
    typeId: "",
    statusId: "",
    vicId: "",
    reportedById: "",
    scheduleId: "",
  })

  const router = useRouter()

  // Mock data - replace with actual API calls
  const incidentTypes = [
    { id: "1", name: "Technical" },
    { id: "2", name: "System" },
    { id: "3", name: "Equipment" },
    { id: "4", name: "Network" },
  ]

  const incidentStatuses = [
    { id: "1", name: "Open" },
    { id: "2", name: "In Progress" },
    { id: "3", name: "Resolved" },
    { id: "4", name: "Closed" },
  ]

  const vics = [
    { id: "vic_001", name: "VIC Centro", code: "VIC001" },
    { id: "vic_002", name: "VIC Norte", code: "VIC002" },
    { id: "vic_003", name: "VIC Sur", code: "VIC003" },
  ]

  const users = [
    { id: "user_001", name: "John Doe" },
    { id: "user_002", name: "Jane Smith" },
    { id: "user_003", name: "Mike Johnson" },
  ]

  useEffect(() => {
    if (incident) {
      setFormData({
        title: incident.title || "",
        description: incident.description || "",
        priority: incident.priority || "MEDIUM",
        sla: incident.sla || 24,
        typeId: incident.typeId || "",
        statusId: incident.statusId || "",
        vicId: incident.vicId || "",
        reportedById: incident.reportedById || "",
        scheduleId: incident.scheduleId || "",
      })
    }
  }, [incident])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Here you would make an API call to create/update the incident
    console.log("Submitting incident:", formData)

    // Mock success
    alert(incident ? "Incident updated successfully!" : "Incident created successfully!")

    // Navigate back to incidents list
    if (onClose) {
      onClose()
    } else {
      router.push("/admin/incidents")
    }
  }

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{incident ? "Edit Incident" : "Create New Incident"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Enter incident title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select value={formData.priority} onValueChange={(value) => handleChange("priority", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
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
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Describe the incident in detail"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="typeId">Incident Type *</Label>
              <Select value={formData.typeId} onValueChange={(value) => handleChange("typeId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {incidentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="statusId">Status *</Label>
              <Select value={formData.statusId} onValueChange={(value) => handleChange("statusId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {incidentStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sla">SLA (hours) *</Label>
              <Input
                id="sla"
                type="number"
                value={formData.sla}
                onChange={(e) => handleChange("sla", Number.parseInt(e.target.value))}
                placeholder="24"
                min="1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vicId">VIC *</Label>
              <Select value={formData.vicId} onValueChange={(value) => handleChange("vicId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select VIC" />
                </SelectTrigger>
                <SelectContent>
                  {vics.map((vic) => (
                    <SelectItem key={vic.id} value={vic.id}>
                      {vic.name} ({vic.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportedById">Reported By *</Label>
              <Select value={formData.reportedById} onValueChange={(value) => handleChange("reportedById", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reporter" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => (onClose ? onClose() : router.push("/admin/incidents"))}
            >
              Cancel
            </Button>
            <Button type="submit">{incident ? "Update Incident" : "Create Incident"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
