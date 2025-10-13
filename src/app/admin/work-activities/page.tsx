"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WorkActivityTable } from "@/components/work-activities/work-activity-table"
import { Spinner } from "@/components/ui/spinner"

// Mock data - replace with actual API calls
const mockWorkActivities = [
  {
    id: "wa_1",
    description: "Replaced faulty sensor in inspection line 2",
    performedAt: "2024-01-20T14:30:00Z",
    workOrderId: "wo_1",
    workOrderTitle: "Sensor Replacement - Line 2",
    partsCount: 2,
    active: true,
    createdAt: "2024-01-20T14:30:00Z",
    updatedAt: "2024-01-20T14:30:00Z",
  },
  {
    id: "wa_2",
    description: "Calibrated emission testing equipment",
    performedAt: "2024-01-19T10:15:00Z",
    workOrderId: "wo_2",
    workOrderTitle: "Equipment Calibration",
    partsCount: 0,
    active: true,
    createdAt: "2024-01-19T10:15:00Z",
    updatedAt: "2024-01-19T10:15:00Z",
  },
  {
    id: "wa_3",
    description: "Updated software configuration for new regulations",
    performedAt: "2024-01-18T16:45:00Z",
    workOrderId: "wo_3",
    workOrderTitle: "Software Update",
    partsCount: 0,
    active: true,
    createdAt: "2024-01-18T16:45:00Z",
    updatedAt: "2024-01-18T16:45:00Z",
  },
]

export default function WorkActivitiesPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [workActivities] = useState(mockWorkActivities)

  const handleEdit = (id: string) => {
    router.push(`/admin/work-activities/${id}/edit`)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this work activity?")) {
      setIsLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setIsLoading(false)
      alert("Work activity deleted successfully!")
    }
  }

  const handleView = (id: string) => {
    router.push(`/admin/work-activities/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading work activities..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Work Activities</h1>
          <p className="text-muted-foreground">Track and manage detailed work activities and tasks</p>
        </div>
        <Button onClick={() => router.push("/admin/work-activities/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Work Activity
        </Button>
      </div>

      <WorkActivityTable data={workActivities} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} />
    </div>
  )
}
