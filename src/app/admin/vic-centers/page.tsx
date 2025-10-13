"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VICCenterTable } from "@/components/vic-centers/vic-center-table"
import { Spinner } from "@/components/ui/spinner"

// Mock data - replace with actual API calls
const mockVICCenters = [
  {
    id: "1",
    code: "VIC001",
    name: "Centro de Verificación Norte",
    address: "Av. Principal 123, Col. Centro",
    phone: "+52 55 1234 5678",
    email: "norte@vic.com",
    lines: 3,
    state: { name: "Ciudad de México" },
    active: true,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "2",
    code: "VIC002",
    name: "Centro de Verificación Sur",
    address: "Calle Secundaria 456, Col. Sur",
    phone: "+52 55 8765 4321",
    email: "sur@vic.com",
    lines: 2,
    state: { name: "Estado de México" },
    active: true,
    createdAt: "2024-01-16T10:00:00Z",
  },
]

export default function VICCentersPage() {
  const [vicCenters, setVICCenters] = useState(mockVICCenters)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const router = useRouter()

  const handleEdit = (id: string) => {
    router.push(`/admin/vic-centers/${id}/edit`)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this VIC center?")) {
      console.log("Delete VIC center:", id)
    }
  }

  const handleView = (id: string) => {
    router.push(`/admin/vic-centers/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading VIC centers..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">VIC Centers</h1>
          <p className="text-muted-foreground">Manage Vehicle Inspection Centers</p>
        </div>
        <Button onClick={() => router.push("/admin/vic-centers/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add VIC Center
        </Button>
      </div>

      <VICCenterTable
        vicCenters={vicCenters}
        totalCount={vicCenters.length}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  )
}
