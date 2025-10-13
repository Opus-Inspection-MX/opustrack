"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IncidentTypeTable } from "@/components/incident-types/incident-type-table"
import { Spinner } from "@/components/ui/spinner"

// Mock data - replace with actual API calls
const mockIncidentTypes = [
  {
    id: 1,
    name: "Hardware Failure",
    description: "Issues related to hardware components and equipment failures",
    active: true,
    incidentCount: 23,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    name: "Software Issue",
    description: "Problems with software applications and system software",
    active: true,
    incidentCount: 18,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 3,
    name: "Network Connectivity",
    description: "Network-related issues including connectivity and performance problems",
    active: true,
    incidentCount: 12,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 4,
    name: "Security Incident",
    description: "Security-related incidents and breaches",
    active: true,
    incidentCount: 5,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
]

export default function IncidentTypesPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [incidentTypes] = useState(mockIncidentTypes)

  const handleEdit = (id: number) => {
    router.push(`/admin/incident-types/${id}/edit`)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this incident type?")) {
      setIsLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setIsLoading(false)
      alert("Incident type deleted successfully!")
    }
  }

  const handleView = (id: number) => {
    router.push(`/admin/incident-types/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading incident types..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incident Types</h1>
          <p className="text-muted-foreground">Manage incident categories and their configurations</p>
        </div>
        <Button onClick={() => router.push("/admin/incident-types/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Incident Type
        </Button>
      </div>

      <IncidentTypeTable data={incidentTypes} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} />
    </div>
  )
}
