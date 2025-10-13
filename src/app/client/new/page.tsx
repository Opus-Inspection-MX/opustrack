"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Send, Loader2, AlertTriangle } from "lucide-react"
import Link from "next/link"

const mockIncidentTypes = [
  { id: "1", name: "Problema de Seguridad" },
  { id: "2", name: "Mal Funcionamiento de Equipo" },
  { id: "3", name: "Red/Conectividad" },
  { id: "4", name: "Control de Acceso" },
  { id: "5", name: "Preocupación de Seguridad" },
  { id: "6", name: "Otro" },
]

const mockVICs = [
  { id: "vic_001", name: "Centro VIC 1" },
  { id: "vic_002", name: "Centro VIC 2" },
  { id: "vic_003", name: "Centro VIC 3" },
  { id: "vic_004", name: "Centro VIC 4" },
  { id: "vic_005", name: "Centro VIC 5" },
]

export default function ReportIncidentPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    typeId: "",
    vicId: "vic_001", // Default VIC
  })

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = "El título es requerido"
    }

    if (!formData.description.trim()) {
      newErrors.description = "La descripción es requerida"
    }

    if (!formData.typeId) {
      newErrors.typeId = "El tipo de incidente es requerido"
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
      console.log("Reporting incident:", formData)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      alert("¡Incidente reportado exitosamente! Te responderemos pronto.")
      router.push("/client")
    } catch (error) {
      console.error("Error reporting incident:", error)
      alert("Error al reportar incidente. Por favor intenta de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/client">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Atrás
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Reportar un Incidente</h1>
            <p className="text-sm text-muted-foreground">Responderemos lo antes posible</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalles del Incidente</CardTitle>
          <CardDescription>
            Por favor proporciona tantos detalles como sea posible para ayudarnos a resolver el problema rápidamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">
                  Título del Incidente <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder="Breve descripción del problema"
                  className={errors.title ? "border-red-500" : ""}
                />
                {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">
                  Prioridad <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.priority} onValueChange={(value) => handleChange("priority", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="CRITICAL">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Descripción <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Proporciona información detallada sobre el incidente..."
                rows={5}
                className={errors.description ? "border-red-500" : ""}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            {/* Type and VIC */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="typeId">
                  Tipo de Incidente <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.typeId} onValueChange={(value) => handleChange("typeId", value)}>
                  <SelectTrigger className={errors.typeId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Selecciona el tipo de incidente" />
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
                <Label htmlFor="vicId">
                  VIC <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.vicId} onValueChange={(value) => handleChange("vicId", value)} disabled>
                  <SelectTrigger className="bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mockVICs.map((vic) => (
                      <SelectItem key={vic.id} value={vic.id}>
                        {vic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">El VIC se asigna según tu cuenta</p>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-initial">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? "Enviando..." : "Enviar Reporte"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/client")} disabled={isSubmitting}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
