"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import { IncidentStatusTable } from "@/components/incident-status/incident-status-table"

// Mock data
const mockIncidentStatuses = [
  {
    id: 1,
    name: "Open",
    incidentCount: 45,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "In Progress",
    incidentCount: 23,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: 3,
    name: "Resolved",
    incidentCount: 156,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: 4,
    name: "Closed",
    incidentCount: 89,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: 5,
    name: "Pending Review",
    incidentCount: 12,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
]

export default function IncidentStatusPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statuses, setStatuses] = useState(mockIncidentStatuses)

  const filteredStatuses = statuses.filter((status) => status.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleEdit = (id: number) => {
    router.push(`/admin/incident-status/${id}/edit`)
  }

  const handleDelete = (id: number) => {
    setStatuses((prev) => prev.filter((status) => status.id !== id))
  }

  const handleView = (id: number) => {
    router.push(`/admin/incident-status/${id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Incident Status</h1>
          <p className="text-muted-foreground">Manage incident status types and their configurations</p>
        </div>
        <Button onClick={() => router.push("/admin/incident-status/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Status
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search statuses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <IncidentStatusTable data={filteredStatuses} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} />
    </div>
  )
}
