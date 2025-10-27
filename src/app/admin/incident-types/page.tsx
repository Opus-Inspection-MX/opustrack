"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IncidentTypeTable } from "@/components/incident-types/incident-type-table"
import { Spinner } from "@/components/ui/spinner"
import { getIncidentTypes, deleteIncidentType } from "@/lib/actions/lookups"

export default function IncidentTypesPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [incidentTypes, setIncidentTypes] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const data = await getIncidentTypes()
      setIncidentTypes(data)
    } catch (error) {
      console.error("Error fetching incident types:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (id: number) => {
    router.push(`/admin/incident-types/${id}/edit`)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this incident type?")) {
      try {
        await deleteIncidentType(id)
        await fetchData()
      } catch (error) {
        console.error("Error deleting incident type:", error)
        alert("Failed to delete incident type")
      }
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
