"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScheduleTable } from "@/components/schedules/schedule-table"
import { Spinner } from "@/components/ui/spinner"

// Mock data - replace with actual API calls
const mockSchedules = [
  {
    id: "sch_1",
    title: "Monthly Maintenance Check",
    description: "Regular monthly maintenance and inspection schedule",
    scheduledAt: "2024-02-15T09:00:00Z",
    vicId: "vic_1",
    vicName: "VIC Center Mexico City",
    incidentCount: 3,
    active: true,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "sch_2",
    title: "Equipment Calibration",
    description: "Quarterly equipment calibration and testing",
    scheduledAt: "2024-02-20T14:00:00Z",
    vicId: "vic_2",
    vicName: "VIC Center Guadalajara",
    incidentCount: 1,
    active: true,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "sch_3",
    title: "System Upgrade",
    description: "Scheduled system upgrade and maintenance window",
    scheduledAt: "2024-01-10T08:00:00Z",
    vicId: "vic_1",
    vicName: "VIC Center Mexico City",
    incidentCount: 0,
    active: true,
    createdAt: "2024-01-05T10:00:00Z",
    updatedAt: "2024-01-05T10:00:00Z",
  },
]

export default function SchedulesPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [schedules] = useState(mockSchedules)

  const handleEdit = (id: string) => {
    router.push(`/admin/schedules/${id}/edit`)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      setIsLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setIsLoading(false)
      alert("Schedule deleted successfully!")
    }
  }

  const handleView = (id: string) => {
    router.push(`/admin/schedules/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading schedules..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">Manage maintenance schedules and planned activities</p>
        </div>
        <Button onClick={() => router.push("/admin/schedules/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      <ScheduleTable data={schedules} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} />
    </div>
  )
}
