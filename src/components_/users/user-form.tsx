"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { FormError } from "@/components/ui/form-error"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft } from "lucide-react"

interface UserFormProps {
  user?: {
    id: string
    name: string
    email: string
    roleId: number
    userStatusId: number
    vicId?: string
    active: boolean
  }
  isEditing?: boolean
}

export function UserForm({ user, isEditing = false }: UserFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    confirmPassword: "",
    roleId: user?.roleId?.toString() || "",
    userStatusId: user?.userStatusId?.toString() || "",
    vicId: user?.vicId || "none",
    active: user?.active ?? true,
  })

  const roles = [
    { id: 1, name: "Admin" },
    { id: 2, name: "Technician" },
    { id: 3, name: "Inspector" },
    { id: 4, name: "Manager" },
  ]

  const userStatuses = [
    { id: 1, name: "Active" },
    { id: 2, name: "Inactive" },
    { id: 3, name: "Suspended" },
    { id: 4, name: "Pending" },
  ]

  const vicCenters = [
    { id: "vic_1", name: "VIC Centro", code: "VIC001" },
    { id: "vic_2", name: "VIC Norte", code: "VIC002" },
    { id: "vic_3", name: "VIC Sur", code: "VIC003" },
  ]

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid"
    }

    if (!isEditing) {
      if (!formData.password) {
        newErrors.password = "Password is required"
      } else if (formData.password.length < 6) {
        newErrors.password = "Password must be at least 6 characters"
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match"
      }
    }

    if (!formData.roleId) {
      newErrors.roleId = "Role is required"
    }

    if (!formData.userStatusId) {
      newErrors.userStatusId = "User status is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      console.log("Form data:", formData)

      // After successful creation/update, redirect to list page
      router.push("/admin/users")
    } catch (error) {
      console.error("Error saving user:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{isEditing ? "Edit User" : "Create User"}</h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update user information" : "Add a new user to the system"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
          <CardDescription>
            {isEditing ? "Update the user details below" : "Enter the user details below"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter full name"
                />
                {errors.name && <FormError message={errors.name} />}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="Enter email address"
                />
                {errors.email && <FormError message={errors.email} />}
              </div>

              {!isEditing && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      placeholder="Enter password"
                    />
                    {errors.password && <FormError message={errors.password} />}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      placeholder="Confirm password"
                    />
                    {errors.confirmPassword && <FormError message={errors.confirmPassword} />}
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="roleId">Role *</Label>
                <Select value={formData.roleId} onValueChange={(value) => handleInputChange("roleId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.roleId && <FormError message={errors.roleId} />}
              </div>

              <div className="space-y-2">
                <Label htmlFor="userStatusId">Status *</Label>
                <Select
                  value={formData.userStatusId}
                  onValueChange={(value) => handleInputChange("userStatusId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {userStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.userStatusId && <FormError message={errors.userStatusId} />}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vicId">VIC Center</Label>
                <Select value={formData.vicId} onValueChange={(value) => handleInputChange("vicId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select VIC center (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No VIC Center</SelectItem>
                    {vicCenters.map((vic) => (
                      <SelectItem key={vic.id} value={vic.id}>
                        {vic.name} ({vic.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => handleInputChange("active", checked)}
                />
                <Label htmlFor="active">Active User</Label>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Spinner size="sm" className="mr-2" />}
                {isEditing ? "Update User" : "Create User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
