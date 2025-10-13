"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Phone, Mail, User, Briefcase, AlertTriangle } from "lucide-react"
import { FormError } from "@/components/ui/form-error"
import { Spinner } from "@/components/ui/spinner"
import { z } from "zod"

const userProfileSchema = z.object({
  telephone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[\d\s\-$$$$]+$/.test(val), {
      message: "Please enter a valid phone number",
    }),
  secondaryTelephone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[\d\s\-$$$$]+$/.test(val), {
      message: "Please enter a valid phone number",
    }),
  emergencyContact: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 5, {
      message: "Emergency contact must be at least 5 characters",
    }),
  jobPosition: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 2, {
      message: "Job position must be at least 2 characters",
    }),
})

type UserProfileFormData = z.infer<typeof userProfileSchema>

interface UserProfileFormProps {
  initialData?: {
    id: string
    name: string
    email: string
    profile?: {
      telephone?: string
      secondaryTelephone?: string
      emergencyContact?: string
      jobPosition?: string
    }
  }
  onSubmit: (data: UserProfileFormData) => Promise<void>
  isOwnProfile?: boolean
}

export function UserProfileForm({ initialData, onSubmit, isOwnProfile = false }: UserProfileFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState<UserProfileFormData>({
    telephone: initialData?.profile?.telephone || "",
    secondaryTelephone: initialData?.profile?.secondaryTelephone || "",
    emergencyContact: initialData?.profile?.emergencyContact || "",
    jobPosition: initialData?.profile?.jobPosition || "",
  })

  const validateField = (name: keyof UserProfileFormData, value: any) => {
    try {
      userProfileSchema.shape[name].parse(value)
      setErrors((prev) => ({ ...prev, [name]: "" }))
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [name]: error.issues[0].message }))
      }
    }
  }

  const handleInputChange = (name: keyof UserProfileFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) {
      validateField(name, value)
    }
  }

  const handleBlur = (name: keyof UserProfileFormData) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    validateField(name, formData[name])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      userProfileSchema.parse(formData)
      setIsLoading(true)
      await onSubmit(formData)

      if (isOwnProfile) {
        // Stay on profile page for own profile
        alert("Profile updated successfully!")
      } else {
        // Go back to users list for admin editing
        router.push("/admin/users")
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach((err) => {
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Name</Label>
              <p className="text-sm">{initialData?.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Email</Label>
              <p className="text-sm flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {initialData?.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>{isOwnProfile ? "My Profile Details" : "User Profile Details"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <Label className="text-base font-medium">Contact Information</Label>
              </div>
              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telephone">Primary Phone</Label>
                  <Input
                    id="telephone"
                    value={formData.telephone}
                    onChange={(e) => handleInputChange("telephone", e.target.value)}
                    onBlur={() => handleBlur("telephone")}
                    placeholder="+1-555-0123"
                    className={errors.telephone ? "border-red-500" : ""}
                  />
                  {errors.telephone && <FormError message={errors.telephone} />}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryTelephone">Secondary Phone</Label>
                  <Input
                    id="secondaryTelephone"
                    value={formData.secondaryTelephone}
                    onChange={(e) => handleInputChange("secondaryTelephone", e.target.value)}
                    onBlur={() => handleBlur("secondaryTelephone")}
                    placeholder="+1-555-0124"
                    className={errors.secondaryTelephone ? "border-red-500" : ""}
                  />
                  {errors.secondaryTelephone && <FormError message={errors.secondaryTelephone} />}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input
                  id="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={(e) => handleInputChange("emergencyContact", e.target.value)}
                  onBlur={() => handleBlur("emergencyContact")}
                  placeholder="Jane Doe - +1-555-0125"
                  className={errors.emergencyContact ? "border-red-500" : ""}
                />
                {errors.emergencyContact && <FormError message={errors.emergencyContact} />}
                <p className="text-xs text-muted-foreground">Include name and phone number of emergency contact</p>
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <Label className="text-base font-medium">Professional Information</Label>
              </div>
              <Separator />

              <div className="space-y-2">
                <Label htmlFor="jobPosition">Job Position</Label>
                <Input
                  id="jobPosition"
                  value={formData.jobPosition}
                  onChange={(e) => handleInputChange("jobPosition", e.target.value)}
                  onBlur={() => handleBlur("jobPosition")}
                  placeholder="Senior Technician"
                  className={errors.jobPosition ? "border-red-500" : ""}
                />
                {errors.jobPosition && <FormError message={errors.jobPosition} />}
              </div>
            </div>

            {/* Error Summary */}
            {hasErrors && (
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Please fix the following errors:</span>
                </div>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {Object.entries(errors).map(([field, error]) => error && <li key={field}>{error}</li>)}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading || hasErrors} className="flex items-center gap-2">
                {isLoading && <Spinner size="sm" />}
                {isLoading ? "Saving..." : "Update Profile"}
              </Button>
              {!isOwnProfile && (
                <Button type="button" variant="outline" onClick={() => router.push("/admin/users")}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
