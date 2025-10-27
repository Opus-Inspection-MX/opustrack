"use client"

import type React from "react"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { Spinner } from "@/components/ui/spinner"
import { FormError } from "@/components/ui/form-error"
import { getScheduleById, updateSchedule, getVICsForSchedules } from "@/lib/actions/schedules"

export default function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [vicCenters, setVicCenters] = useState<any[]>([])

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduledAt: "",
    vicId: "",
    active: true,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [schedule, vics] = await Promise.all([
          getScheduleById(id),
          getVICsForSchedules()
        ])

        if (schedule) {
          setFormData({
            title: schedule.title,
            description: schedule.description || "",
            scheduledAt: new Date(schedule.scheduledAt).toISOString().slice(0, 16),
            vicId: schedule.vicId,
            active: schedule.active,
          })
        }
        setVicCenters(vics)
      } catch (error) {
        console.error("Error fetching data:", error)
        setErrors({ submit: "Failed to load schedule data" })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = "Title is required"
    } else if (formData.title.length > 200) {
      newErrors.title = "Title must be less than 200 characters"
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description = "Description must be less than 1000 characters"
    }

    if (!formData.scheduledAt) {
      newErrors.scheduledAt = "Scheduled date and time is required"
    }

    if (!formData.vicId) {
      newErrors.vicId = "VIC Center is required"
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
      await updateSchedule(id, {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        scheduledAt: new Date(formData.scheduledAt),
        vicId: formData.vicId,
      })

      router.push(`/admin/schedules/${id}`)
      router.refresh()
    } catch (error) {
      console.error("Error updating schedule:", error)
      setErrors({ submit: error instanceof Error ? error.message : "Failed to update schedule. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" text="Loading schedule..." />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/schedules/${id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Schedule</h1>
          <p className="text-muted-foreground">Update schedule information</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Schedule Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && <FormError message={errors.submit} />}

            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="e.g., Monthly Maintenance Check"
                className={errors.title ? "border-red-500" : ""}
              />
              {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
              <p className="text-sm text-muted-foreground">{formData.title.length}/200</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe the scheduled activity..."
                rows={4}
                className={errors.description ? "border-red-500" : ""}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
              <p className="text-sm text-muted-foreground">{formData.description.length}/1000</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt">
                Scheduled Date & Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => handleChange("scheduledAt", e.target.value)}
                className={errors.scheduledAt ? "border-red-500" : ""}
              />
              {errors.scheduledAt && <p className="text-sm text-red-500">{errors.scheduledAt}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vicId">
                VIC Center <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.vicId} onValueChange={(value) => handleChange("vicId", value)}>
                <SelectTrigger className={errors.vicId ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select VIC Center" />
                </SelectTrigger>
                <SelectContent>
                  {vicCenters.map((vic) => (
                    <SelectItem key={vic.id} value={vic.id}>
                      {vic.code} - {vic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.vicId && <p className="text-sm text-red-500">{errors.vicId}</p>}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleChange("active", checked)}
              />
              <Label htmlFor="active">Active</Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/admin/schedules/${id}`)}
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
