"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StateTable } from "@/components/states/state-table"
import { Spinner } from "@/components/ui/spinner"

// Mock data - replace with actual API calls
const mockStates = [
  {
    id: 1,
    name: "Ciudad de México",
    code: "CDMX",
    vicCount: 15,
    active: true,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    name: "Estado de México",
    code: "EDOMEX",
    vicCount: 8,
    active: true,
    createdAt: "2024-01-16T10:00:00Z",
    updatedAt: "2024-01-16T10:00:00Z",
  },
  {
    id: 3,
    name: "Jalisco",
    code: "JAL",
    vicCount: 12,
    active: true,
    createdAt: "2024-01-17T10:00:00Z",
    updatedAt: "2024-01-17T10:00:00Z",
  },
  {
    id: 4,
    name: "Nuevo León",
    code: "NL",
    vicCount: 6,
    active: true,
    createdAt: "2024-01-18T10:00:00Z",
    updatedAt: "2024-01-18T10:00:00Z",
  },
  {
    id: 5,
    name: "Puebla",
    code: "PUE",
    vicCount: 4,
    active: false,
    createdAt: "2024-01-19T10:00:00Z",
    updatedAt: "2024-01-19T10:00:00Z",
  },
]

export default function StatesPage() {
  const [states, setStates] = useState(mockStates)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const router = useRouter()

  const handleEdit = (id: number) => {
    router.push(`/admin/states/${id}/edit`)
  }

  const handleDelete = async (id: number) => {
    const state = states.find((s) => s.id === id)
    if (state && state.vicCount && state.vicCount > 0) {
      alert("Cannot delete state with associated VIC centers. Please reassign or delete VIC centers first.")
      return
    }

    if (confirm("Are you sure you want to delete this state?")) {
      setIsLoading(true)
      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500))
        setStates((prev) => prev.filter((s) => s.id !== id))
        console.log("Delete state:", id)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleView = (id: number) => {
    router.push(`/admin/states/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading states..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">States</h1>
          <p className="text-muted-foreground">Manage geographic states and regions</p>
        </div>
        <Button onClick={() => router.push("/admin/states/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add State
        </Button>
      </div>

      <StateTable
        states={states}
        totalCount={states.length}
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
