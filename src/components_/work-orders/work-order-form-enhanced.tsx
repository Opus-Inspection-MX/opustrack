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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { workOrderSchema, type WorkOrderFormData } from "@/lib/validations"
import { Loader2, Plus, Trash2, Upload, Package, Camera } from "lucide-react"

interface WorkOrderFormEnhancedProps {
  workOrder?: any
  incident?: any
  onClose?: () => void
}

interface WorkPart {
  id: string
  partId: string
  partName: string
  quantity: number
  price: number
  description?: string
}

interface Attachment {
  id: string
  filename: string
  size: number
  description?: string
}

export function WorkOrderFormEnhanced({ workOrder, incident, onClose }: WorkOrderFormEnhancedProps) {
  const [formData, setFormData] = useState<WorkOrderFormData>({
    incidentId: "",
    assignedToId: "",
    status: "PENDING",
    notes: "",
    startedAt: "",
    finishedAt: "",
  })

  const [workParts, setWorkParts] = useState<WorkPart[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const router = useRouter()

  // Mock data
  const users = [
    { id: "user_001", name: "John Doe", role: "Technician" },
    { id: "user_002", name: "Jane Smith", role: "System Admin" },
    { id: "user_003", name: "Mike Johnson", role: "Network Specialist" },
    { id: "user_004", name: "Sarah Wilson", role: "Equipment Specialist" },
  ]

  const availableParts = [
    { id: "part_001", name: "Brake Pad Set", price: 89.99, stock: 25 },
    { id: "part_002", name: "Oil Filter", price: 15.5, stock: 50 },
    { id: "part_003", name: "Air Filter", price: 22.75, stock: 30 },
    { id: "part_004", name: "Spark Plugs", price: 45.0, stock: 15 },
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
      setWorkParts(workOrder.workParts || [])
      setAttachments(workOrder.attachments || [])
    } else if (incident) {
      setFormData((prev) => ({
        ...prev,
        incidentId: incident.id,
      }))
    }
  }, [workOrder, incident])

  const addWorkPart = () => {
    const newPart: WorkPart = {
      id: `temp_${Date.now()}`,
      partId: "",
      partName: "",
      quantity: 1,
      price: 0,
      description: "",
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
          description: "",
        }
        setAttachments((prev) => [...prev, newAttachment])
      })
    }
  }

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      Array.from(files).forEach((file) => {
        const newAttachment: Attachment = {
          id: `temp_${Date.now()}_${file.name}`,
          filename: file.name,
          size: file.size,
          description: "",
        }
        setAttachments((prev) => [...prev, newAttachment])
      })
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const validatedData = workOrderSchema.parse(formData)
      setErrors({})

      const submitData = {
        ...validatedData,
        workParts,
        attachments,
      }

      console.log("Submitting work order:", submitData)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      alert(workOrder ? "Work order updated successfully!" : "Work order created successfully!")

      if (onClose) {
        onClose()
      } else {
        router.push("/admin/work-orders")
      }
    } catch (error: any) {
      if (error.errors) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach((err: any) => {
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
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-lg sm:text-xl">
            {workOrder ? "Editar Orden de Trabajo" : "Crear Nueva Orden de Trabajo"}
          </span>
          {incident && (
            <Badge variant="outline" className="w-fit">
              Incidente: {incident.title}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="basic" className="text-xs sm:text-sm">
                Info Básica
              </TabsTrigger>
              <TabsTrigger value="parts" className="text-xs sm:text-sm">
                Partes ({workParts.length})
              </TabsTrigger>
              <TabsTrigger value="attachments" className="text-xs sm:text-sm">
                Archivos ({attachments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              {incident && (
                <div className="p-3 sm:p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Incidente Relacionado</h4>
                  <div className="text-xs sm:text-sm space-y-1">
                    <div>
                      <strong>Título:</strong> {incident.title}
                    </div>
                    <div>
                      <strong>Prioridad:</strong> {incident.priority}
                    </div>
                    <div>
                      <strong>VIC:</strong> {incident.vic?.name}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignedToId" className="text-sm">
                    Asignar a *
                  </Label>
                  <Select value={formData.assignedToId} onValueChange={(value) => handleChange("assignedToId", value)}>
                    <SelectTrigger className={errors.assignedToId ? "border-destructive" : ""}>
                      <SelectValue placeholder="Seleccionar técnico" />
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
                  <Label htmlFor="status" className="text-sm">
                    Estado *
                  </Label>
                  <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                    <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                      <SelectValue placeholder="Seleccionar estado" />
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
                <Label htmlFor="notes" className="text-sm">
                  Notas
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Agregar notas o instrucciones adicionales"
                  rows={4}
                  className={errors.notes ? "border-destructive" : ""}
                />
                <FormError message={errors.notes} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startedAt" className="text-sm">
                    Fecha de Inicio
                  </Label>
                  <Input
                    id="startedAt"
                    type="datetime-local"
                    value={formData.startedAt}
                    onChange={(e) => handleChange("startedAt", e.target.value)}
                    className={errors.startedAt ? "border-destructive" : ""}
                  />
                  <FormError message={errors.startedAt} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finishedAt" className="text-sm">
                    Fecha de Finalización
                  </Label>
                  <Input
                    id="finishedAt"
                    type="datetime-local"
                    value={formData.finishedAt}
                    onChange={(e) => handleChange("finishedAt", e.target.value)}
                    disabled={formData.status !== "COMPLETED"}
                    className={errors.finishedAt ? "border-destructive" : ""}
                  />
                  <FormError message={errors.finishedAt} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="parts" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-base sm:text-lg font-semibold">Partes Utilizadas</h3>
                <Button type="button" onClick={addWorkPart} size="sm" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Parte
                </Button>
              </div>

              {workParts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 mb-4" />
                  <p className="text-sm sm:text-base">No hay partes agregadas</p>
                  <p className="text-xs sm:text-sm">
                    Haz clic en "Agregar Parte" para incluir partes usadas en esta orden
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {workParts.map((part, index) => (
                    <Card key={part.id} className="p-3 sm:p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                          <Label className="text-sm">Parte</Label>
                          <Select value={part.partId} onValueChange={(value) => updateWorkPart(index, "partId", value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar parte" />
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
                          <Label className="text-sm">Cantidad</Label>
                          <Input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) => updateWorkPart(index, "quantity", Number.parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Precio Unitario</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={part.price}
                            onChange={(e) => updateWorkPart(index, "price", Number.parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Acciones</Label>
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
                      <div className="mt-3 sm:mt-4">
                        <Label className="text-sm">Descripción (Opcional)</Label>
                        <Input
                          placeholder="Notas adicionales para esta parte"
                          value={part.description}
                          onChange={(e) => updateWorkPart(index, "description", e.target.value)}
                        />
                      </div>
                      <div className="mt-2 text-right">
                        <span className="text-sm sm:text-base font-semibold">
                          Subtotal: ${(part.quantity * part.price).toFixed(2)}
                        </span>
                      </div>
                    </Card>
                  ))}
                  <div className="text-right">
                    <div className="text-base sm:text-lg font-bold">
                      Costo Total de Partes: ${calculateTotal().toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="attachments" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-base sm:text-lg font-semibold">Archivos Adjuntos</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                    id="camera-capture"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById("camera-capture")?.click()}
                    className="w-full sm:w-auto"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Tomar Foto
                  </Button>

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
                    onClick={() => document.getElementById("file-upload")?.click()}
                    className="w-full sm:w-auto"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Subir Archivos
                  </Button>
                </div>
              </div>

              {attachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Upload className="mx-auto h-12 w-12 mb-4" />
                  <p className="text-sm sm:text-base">No hay archivos adjuntos</p>
                  <p className="text-xs sm:text-sm">
                    Toma fotos o sube documentos relacionados con esta orden de trabajo
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <Card key={attachment.id} className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Upload className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm sm:text-base truncate">{attachment.filename}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              {formatFileSize(attachment.size)}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeAttachment(attachment.id)}
                          className="w-full sm:w-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2">
                        <Input
                          placeholder="Descripción del archivo (opcional)"
                          value={attachment.description}
                          onChange={(e) => {
                            const updated = attachments.map((att) =>
                              att.id === attachment.id ? { ...att, description: e.target.value } : att,
                            )
                            setAttachments(updated)
                          }}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => (onClose ? onClose() : router.push("/admin/work-orders"))}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {workOrder ? "Actualizar Orden" : "Crear Orden"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
