"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import { IncidentStatusTable } from "@/components/incident-status/incident-status-table"
import { Spinner } from "@/components/ui/spinner"
import { getIncidentStatuses, deleteIncidentStatus } from "@/lib/actions/lookups"

export default function IncidentStatusPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statuses, setStatuses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const data = await getIncidentStatuses()
      setStatuses(data)
    } catch (error) {
      console.error("Error fetching incident statuses:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredStatuses = statuses.filter((status) => status.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleEdit = (id: number) => {
    router.push(`/admin/incident-status/${id}/edit`)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this incident status?")) {
      try {
        await deleteIncidentStatus(id)
        await fetchData()
      } catch (error) {
        console.error("Error deleting incident status:", error)
        alert("Failed to delete incident status")
      }
    }
  }

  const handleView = (id: number) => {
    router.push(`/admin/incident-status/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading incident statuses..." />
      </div>
    )
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
