"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Plus, Trash2, Upload, Camera, FileText, Package, Activity } from "lucide-react"

// Mock incident data
const mockIncident = {
  id: "inc_001",
  title: "Equipment Malfunction - Building A",
  description: "Security camera not functioning properly. Need immediate replacement and testing.",
  priority: "HIGH",
  sla: 4,
  type: { name: "Equipment" },
  status: { name: "In Progress" },
  vic: { name: "VIC Centro", code: "VIC001" },
  reportedBy: { name: "John Manager" },
  reportedAt: "2024-01-15T09:00:00Z",
}

const availableParts = [
  { id: "part_001", name: "Security Camera HD", price: 299.99, stock: 15 },
  { id: "part_002", name: "Mounting Bracket", price: 25.5, stock: 50 },
  { id: "part_003", name: "Power Cable 10m", price: 15.75, stock: 30 },
  { id: "part_004", name: "Network Cable Cat6", price: 12.0, stock: 100 },
]

interface WorkActivity {
  id: string
  description: string
  performedAt: string
}

interface WorkPart {
  id: string
  partId: string
  partName: string
  quantity: number
  price: number
}

interface Attachment {
  id: string
  filename: string
  size: number
  type: string
  file?: File
}

export default function CompleteIncidentPage() {
  const router = useRouter()
  const params = useParams()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Work Order fields
  const [workOrderNotes, setWorkOrderNotes] = useState("")
  const [workOrderStatus, setWorkOrderStatus] = useState("IN_PROGRESS")
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 16))
  const [finishedAt, setFinishedAt] = useState("")

  // Work Activities
  const [workActivities, setWorkActivities] = useState<WorkActivity[]>([])
  const [newActivityDescription, setNewActivityDescription] = useState("")

  // Parts
  const [workParts, setWorkParts] = useState<WorkPart[]>([])

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const addWorkActivity = () => {
    if (newActivityDescription.trim()) {
      const newActivity: WorkActivity = {
        id: `activity_${Date.now()}`,
        description: newActivityDescription,
        performedAt: new Date().toISOString(),
      }
      setWorkActivities([...workActivities, newActivity])
      setNewActivityDescription("")
    }
  }

  const removeWorkActivity = (id: string) => {
    setWorkActivities(workActivities.filter((activity) => activity.id !== id))
  }

  const addWorkPart = () => {
    const newPart: WorkPart = {
      id: `temp_${Date.now()}`,
      partId: "",
      partName: "",
      quantity: 1,
      price: 0,
    }
    setWorkParts([...workParts, newPart])
  }

  const updateWorkPart = (index: number, field: keyof WorkPart, value: any) => {
    const updatedParts = [...workParts]
    if (field === "partId") {
      const selectedPart = availableParts.find((p) => p.id === value)
      if (selectedPart) {
        updatedParts[index] = {
          ...updatedParts[index],
          partId: value,
          partName: selectedPart.name,
          price: selectedPart.price,
        }
      }
    } else {
      updatedParts[index] = { ...updatedParts[index], [field]: value }
    }
    setWorkParts(updatedParts)
  }

  const removeWorkPart = (index: number) => {
    setWorkParts(workParts.filter((_, i) => i !== index))
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      Array.from(files).forEach((file) => {
        const newAttachment: Attachment = {
          id: `temp_${Date.now()}_${file.name}`,
          filename: file.name,
          size: file.size,
          type: file.type,
          file: file,
        }
        setAttachments((prev) => [...prev, newAttachment])
      })
    }
  }

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(event)
  }

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((att) => att.id !== id))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const calculateTotal = () => {
    return workParts.reduce((total, part) => total + part.quantity * part.price, 0)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const submitData = {
        incidentId: params.id,
        workOrder: {
          notes: workOrderNotes,
          status: workOrderStatus,
          startedAt,
          finishedAt: workOrderStatus === "COMPLETED" ? finishedAt : null,
        },
        workActivities,
        workParts,
        attachments,
      }

      console.log("Submitting incident completion:", submitData)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      alert("Incident completed successfully!")
      router.push("/fsr/incidents")
    } catch (error) {
      console.error("Error submitting:", error)
      alert("Error completing incident. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Complete Incident</h1>
          <p className="text-muted-foreground mt-2">Add work order, activities, parts, and attachments</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/fsr/incidents")}>
          Cancel
        </Button>
      </div>

      {/* Incident Details */}
      <Card>
        <CardHeader>
          <CardTitle>Incident Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-orange-100 text-orange-800">{mockIncident.priority}</Badge>
              <Badge className="bg-yellow-100 text-yellow-800">{mockIncident.status.name}</Badge>
              <Badge variant="outline">{mockIncident.type.name}</Badge>
              <Badge variant="outline">SLA: {mockIncident.sla}h</Badge>
            </div>
            <div>
              <h3 className="font-semibold text-lg">{mockIncident.title}</h3>
              <p className="text-muted-foreground mt-1">{mockIncident.description}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">VIC:</span> {mockIncident.vic.name} ({mockIncident.vic.code})
              </div>
              <div>
                <span className="font-medium">Reported by:</span> {mockIncident.reportedBy.name}
              </div>
              <div>
                <span className="font-medium">Reported:</span> {new Date(mockIncident.reportedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Form */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="workorder" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="workorder">Work Order</TabsTrigger>
              <TabsTrigger value="activities">Activities ({workActivities.length})</TabsTrigger>
              <TabsTrigger value="parts">Parts ({workParts.length})</TabsTrigger>
              <TabsTrigger value="attachments">Files ({attachments.length})</TabsTrigger>
            </TabsList>

            {/* Work Order Tab */}
            <TabsContent value="workorder" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={workOrderStatus} onValueChange={setWorkOrderStatus}>
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

                <div className="space-y-2">
                  <Label htmlFor="startedAt">Started At *</Label>
                  <Input
                    id="startedAt"
                    type="datetime-local"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                  />
                </div>
              </div>

              {workOrderStatus === "COMPLETED" && (
                <div className="space-y-2">
                  <Label htmlFor="finishedAt">Finished At *</Label>
                  <Input
                    id="finishedAt"
                    type="datetime-local"
                    value={finishedAt}
                    onChange={(e) => setFinishedAt(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Work Notes</Label>
                <Textarea
                  id="notes"
                  value={workOrderNotes}
                  onChange={(e) => setWorkOrderNotes(e.target.value)}
                  placeholder="Describe the work performed, issues found, and resolution..."
                  rows={6}
                />
              </div>
            </TabsContent>

            {/* Work Activities Tab */}
            <TabsContent value="activities" className="space-y-4 mt-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="newActivity">Add Work Activity</Label>
                  <Input
                    id="newActivity"
                    value={newActivityDescription}
                    onChange={(e) => setNewActivityDescription(e.target.value)}
                    placeholder="Describe the activity performed..."
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addWorkActivity()
                      }
                    }}
                  />
                </div>
                <Button type="button" onClick={addWorkActivity}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {workActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="mx-auto h-12 w-12 mb-4" />
                  <p>No activities added yet</p>
                  <p className="text-sm">Add activities to document the work performed</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workActivities.map((activity) => (
                    <Card key={activity.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{activity.description}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(activity.performedAt).toLocaleString()}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeWorkActivity(activity.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Parts Tab */}
            <TabsContent value="parts" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Parts Used</h3>
                <Button type="button" onClick={addWorkPart} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Part
                </Button>
              </div>

              {workParts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 mb-4" />
                  <p>No parts added yet</p>
                  <p className="text-sm">Add parts used in this work order</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {workParts.map((part, index) => (
                    <Card key={part.id} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Part</Label>
                          <Select value={part.partId} onValueChange={(value) => updateWorkPart(index, "partId", value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select part" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableParts.map((availablePart) => (
                                <SelectItem key={availablePart.id} value={availablePart.id}>
                                  {availablePart.name} - ${availablePart.price}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) => updateWorkPart(index, "quantity", Number.parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={part.price}
                            onChange={(e) => updateWorkPart(index, "price", Number.parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Actions</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeWorkPart(index)}
                            className="w-full"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 text-right">
                        <span className="font-semibold">Subtotal: ${(part.quantity * part.price).toFixed(2)}</span>
                      </div>
                    </Card>
                  ))}
                  <div className="text-right">
                    <div className="text-lg font-bold">Total Parts Cost: ${calculateTotal().toFixed(2)}</div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Attachments Tab */}
            <TabsContent value="attachments" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Attachments</h3>
                <div className="flex gap-2">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload File
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                    id="camera-capture"
                  />
                  <Button type="button" size="sm" onClick={() => document.getElementById("camera-capture")?.click()}>
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                </div>
              </div>

              {attachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-4" />
                  <p>No files attached</p>
                  <p className="text-sm">Upload photos, PDFs, or other documents</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <Card key={attachment.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {attachment.type.startsWith("image/") ? (
                            <Camera className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium">{attachment.filename}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatFileSize(attachment.size)} • {attachment.type}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeAttachment(attachment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/fsr/incidents")} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} size="lg">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Complete Incident
        </Button>
      </div>
    </div>
  )
}
