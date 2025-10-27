"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit, Calendar, Building2, Clock, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Spinner } from "@/components/ui/spinner"
import { getScheduleById } from "@/lib/actions/schedules"

interface Schedule {
  id: string
  title: string
  description?: string | null
  scheduledAt: Date
  vicId: string
  vic: {
    id: string
    name: string
    code: string
  }
  incidents: any[]
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export default function ViewSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [schedule, setSchedule] = useState<Schedule | null>(null)

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true)
        const data = await getScheduleById(id)
        setSchedule(data as any)
      } catch (error) {
        console.error("Error fetching schedule:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSchedule()
  }, [id])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" text="Loading schedule..." />
        </div>
      </div>
    )
  }

  if (!schedule) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Schedule not found</p>
            <Link href="/admin/schedules">
              <Button className="mt-4">Back to Schedules</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getScheduleStatus = () => {
    const now = new Date()
    const scheduleDate = new Date(schedule.scheduledAt)

    if (scheduleDate < now) {
      return { label: "Past", variant: "secondary" as const, color: "text-gray-600" }
    } else if (scheduleDate.toDateString() === now.toDateString()) {
      return { label: "Today", variant: "default" as const, color: "text-blue-600" }
    } else {
      return { label: "Upcoming", variant: "outline" as const, color: "text-green-600" }
    }
  }

  const status = getScheduleStatus()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/schedules">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Schedule Details</h1>
            <p className="text-muted-foreground">View schedule information</p>
          </div>
        </div>
        <Link href={`/admin/schedules/${schedule.id}/edit`}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit Schedule
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <p className="text-lg font-semibold">{schedule.title}</p>
            </div>

            {schedule.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm">{schedule.description}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={status.variant}>{status.label}</Badge>
                <Badge variant={schedule.active ? "default" : "secondary"}>
                  {schedule.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Schedule Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Scheduled Date & Time</label>
              <p className="text-lg font-semibold">{new Date(schedule.scheduledAt).toLocaleString()}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">VIC Center</label>
              <div className="flex items-center gap-2 mt-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{schedule.vic.code}</span>
                <span className="text-sm text-muted-foreground">- {schedule.vic.name}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Related Incidents</label>
              <p className="text-lg font-semibold">{schedule.incidents?.length || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Timestamps</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created At</label>
              <p className="text-sm">{new Date(schedule.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-sm">{new Date(schedule.updatedAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
