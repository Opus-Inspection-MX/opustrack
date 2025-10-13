"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save } from "lucide-react"
import { FormError } from "@/components/ui/form-error"

export default function NewUserPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    roleId: "none",
    userStatusId: "none",
    vicId: "none",
  })

  // Mock data - replace with actual API calls
  const roles = [
    { id: "1", name: "Admin" },
    { id: "2", name: "Technician" },
    { id: "3", name: "Manager" },
  ]

  const userStatuses = [
    { id: "1", name: "Active" },
    { id: "2", name: "Inactive" },
    { id: "3", name: "Suspended" },
  ]

  const vics = [
    { id: "1", name: "VIC Center 1", code: "VIC001" },
    { id: "2", name: "VIC Center 2", code: "VIC002" },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsSubmitting(true)

    try {
      // Validation
      const newErrors: Record<string, string> = {}

      if (!formData.username.trim()) {
        newErrors.username = "Username is required"
      }

      if (!formData.email.trim()) {
        newErrors.email = "Email is required"
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Invalid email format"
      }

      if (!formData.firstName.trim()) {
        newErrors.firstName = "First name is required"
      }

      if (!formData.lastName.trim()) {
        newErrors.lastName = "Last name is required"
      }

      if (formData.roleId === "none") {
        newErrors.roleId = "Role is required"
      }

      if (formData.userStatusId === "none") {
        newErrors.userStatusId = "User status is required"
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        setIsSubmitting(false)
        return
      }

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      console.log("Creating user:", formData)

      // Redirect to users list
      router.push("/admin/users")
    } catch (error) {
      console.error("Error creating user:", error)
      setErrors({ submit: "Failed to create user. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create User</h1>
          <p className="text-muted-foreground">Add a new user to the system</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && <FormError message={errors.submit} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => {
                    setFormData({ ...formData, username: e.target.value })
                    if (errors.username) {
                      setErrors({ ...errors, username: "" })
                    }
                  }}
                  placeholder="Enter username"
                />
                {errors.username && <FormError message={errors.username} />}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value })
                    if (errors.email) {
                      setErrors({ ...errors, email: "" })
                    }
                  }}
                  placeholder="Enter email"
                />
                {errors.email && <FormError message={errors.email} />}
              </div>

              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => {
                    setFormData({ ...formData, firstName: e.target.value })
                    if (errors.firstName) {
                      setErrors({ ...errors, firstName: "" })
                    }
                  }}
                  placeholder="Enter first name"
                />
                {errors.firstName && <FormError message={errors.firstName} />}
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => {
                    setFormData({ ...formData, lastName: e.target.value })
                    if (errors.lastName) {
                      setErrors({ ...errors, lastName: "" })
                    }
                  }}
                  placeholder="Enter last name"
                />
                {errors.lastName && <FormError message={errors.lastName} />}
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="roleId">
                  Role <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.roleId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, roleId: value })
                    if (errors.roleId) {
                      setErrors({ ...errors, roleId: "" })
                    }
                  }}
                >
                  <SelectTrigger id="roleId">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select role</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.roleId && <FormError message={errors.roleId} />}
              </div>

              {/* User Status */}
              <div className="space-y-2">
                <Label htmlFor="userStatusId">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.userStatusId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, userStatusId: value })
                    if (errors.userStatusId) {
                      setErrors({ ...errors, userStatusId: "" })
                    }
                  }}
                >
                  <SelectTrigger id="userStatusId">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select status</SelectItem>
                    {userStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.userStatusId && <FormError message={errors.userStatusId} />}
              </div>

              {/* VIC Center */}
              <div className="space-y-2">
                <Label htmlFor="vicId">VIC Center</Label>
                <Select value={formData.vicId} onValueChange={(value) => setFormData({ ...formData, vicId: value })}>
                  <SelectTrigger id="vicId">
                    <SelectValue placeholder="Select VIC center" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No VIC Center</SelectItem>
                    {vics.map((vic) => (
                      <SelectItem key={vic.id} value={vic.id}>
                        {vic.name} ({vic.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="mr-2">Creating...</span>
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Create User
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
