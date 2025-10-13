"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormError } from "@/components/ui/form-error"
import { Spinner } from "@/components/ui/spinner"
import { AlertCircle } from "lucide-react"

const vicCenterSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(20, "Code must be less than 20 characters")
    .regex(/^[A-Z0-9]+$/, "Code must be uppercase letters and numbers only"),
  name: z.string().min(3, "Name must be at least 3 characters").max(200, "Name must be less than 200 characters"),
  address: z.string().optional(),
  rfc: z
    .string()
    .regex(/^[A-Z&Ñ]{3,4}[0-9]{6}[A-V1-9][A-Z1-9][0-9A]$/, "Invalid RFC format")
    .optional()
    .or(z.literal("")),
  companyName: z.string().max(200, "Company name must be less than 200 characters").optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  contact: z.string().max(100, "Contact name must be less than 100 characters").optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  lines: z.number().min(1, "Must have at least 1 line").max(20, "Cannot have more than 20 lines"),
  stateId: z.number().min(1, "Please select a state"),
  active: z.boolean(),
})

type VICCenterFormData = z.infer<typeof vicCenterSchema>

interface State {
  id: number
  name: string
  code: string
}

interface VICCenterFormProps {
  initialData?: Partial<VICCenterFormData> & { id?: string }
  isEditing?: boolean
}

// Mock states data
const mockStates: State[] = [
  { id: 1, name: "Ciudad de México", code: "CDMX" },
  { id: 2, name: "Estado de México", code: "EDOMEX" },
  { id: 3, name: "Jalisco", code: "JAL" },
  { id: 4, name: "Nuevo León", code: "NL" },
  { id: 5, name: "Puebla", code: "PUE" },
]

export function VICCenterForm({ initialData, isEditing = false }: VICCenterFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [states, setStates] = useState<State[]>(mockStates)

  const [formData, setFormData] = useState<VICCenterFormData>({
    code: initialData?.code || "",
    name: initialData?.name || "",
    address: initialData?.address || "",
    rfc: initialData?.rfc || "",
    companyName: initialData?.companyName || "",
    phone: initialData?.phone || "",
    contact: initialData?.contact || "",
    email: initialData?.email || "",
    lines: initialData?.lines || 1,
    stateId: initialData?.stateId || 0,
    active: initialData?.active ?? true,
  })

  const validateField = (name: keyof VICCenterFormData, value: any) => {
    try {
      vicCenterSchema.pick({ [name]: true }).parse({ [name]: value })
      setErrors((prev) => ({ ...prev, [name]: "" }))
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [name]: error.errors[0]?.message || "" }))
      }
    }
  }

  const handleInputChange = (name: keyof VICCenterFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) {
      validateField(name, value)
    }
  }

  const handleBlur = (name: keyof VICCenterFormData) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    validateField(name, formData[name])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const validatedData = vicCenterSchema.parse(formData)
      setIsLoading(true)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      console.log(isEditing ? "Update VIC center:" : "Create VIC center:", validatedData)

      router.push("/admin/vic-centers")
      router.refresh()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message
          }
        })
        setErrors(fieldErrors)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const hasErrors = Object.values(errors).some((error) => error !== "")

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit VIC Center" : "Create New VIC Center"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update VIC center information" : "Add a new Vehicle Inspection Center to the system"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">VIC Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleInputChange("code", e.target.value.toUpperCase())}
                  onBlur={() => handleBlur("code")}
                  placeholder="e.g., VIC001"
                  className={errors.code ? "border-red-500" : ""}
                />
                <FormError message={errors.code} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Center Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                  placeholder="e.g., Centro de Verificación Norte"
                  className={errors.name ? "border-red-500" : ""}
                />
                <FormError message={errors.name} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stateId">State *</Label>
                <Select
                  value={formData.stateId.toString()}
                  onValueChange={(value) => handleInputChange("stateId", Number.parseInt(value))}
                >
                  <SelectTrigger className={errors.stateId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state.id} value={state.id.toString()}>
                        {state.name} ({state.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormError message={errors.stateId} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lines">Number of Lines *</Label>
                <Input
                  id="lines"
                  type="number"
                  min="1"
                  max="20"
                  value={formData.lines}
                  onChange={(e) => handleInputChange("lines", Number.parseInt(e.target.value) || 1)}
                  onBlur={() => handleBlur("lines")}
                  className={errors.lines ? "border-red-500" : ""}
                />
                <FormError message={errors.lines} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                onBlur={() => handleBlur("address")}
                placeholder="Full address of the VIC center"
                rows={2}
              />
            </div>
          </div>

          {/* Company Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange("companyName", e.target.value)}
                  onBlur={() => handleBlur("companyName")}
                  placeholder="Legal company name"
                />
                <FormError message={errors.companyName} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rfc">RFC</Label>
                <Input
                  id="rfc"
                  value={formData.rfc}
                  onChange={(e) => handleInputChange("rfc", e.target.value.toUpperCase())}
                  onBlur={() => handleBlur("rfc")}
                  placeholder="e.g., ABC123456789"
                  className={errors.rfc ? "border-red-500" : ""}
                />
                <FormError message={errors.rfc} />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Person</Label>
                <Input
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => handleInputChange("contact", e.target.value)}
                  onBlur={() => handleBlur("contact")}
                  placeholder="Contact person name"
                />
                <FormError message={errors.contact} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  onBlur={() => handleBlur("phone")}
                  placeholder="+52 55 1234 5678"
                  className={errors.phone ? "border-red-500" : ""}
                />
                <FormError message={errors.phone} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                placeholder="contact@vic.com"
                className={errors.email ? "border-red-500" : ""}
              />
              <FormError message={errors.email} />
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

          {hasErrors && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">Please fix the errors above before submitting.</span>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isLoading || hasErrors} className="flex-1">
              {isLoading ? (
                <>
                  <Spinner size="sm" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update VIC Center"
              ) : (
                "Create VIC Center"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
