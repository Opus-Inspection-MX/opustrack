"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PartTable } from "@/components/parts/part-table"
import { Spinner } from "@/components/ui/spinner"

// Mock data - replace with actual API calls
const mockParts = [
  {
    id: "1",
    name: "Brake Pad Set",
    description: "High-quality ceramic brake pads",
    price: 89.99,
    stock: 25,
    vic: { name: "VIC Center 1", code: "VIC001" },
    active: true,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "2",
    name: "Oil Filter",
    description: "Premium oil filter for regular maintenance",
    price: 15.5,
    stock: 5,
    vic: { name: "VIC Center 1", code: "VIC001" },
    active: true,
    createdAt: "2024-01-16T10:00:00Z",
  },
  {
    id: "3",
    name: "Air Filter",
    description: "High-efficiency air filter",
    price: 22.75,
    stock: 0,
    vic: { name: "VIC Center 2", code: "VIC002" },
    active: true,
    createdAt: "2024-01-17T10:00:00Z",
  },
]

export default function PartsPage() {
  const [parts, setParts] = useState(mockParts)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const router = useRouter()

  const handleEdit = (id: string) => {
    router.push(`/admin/parts/${id}/edit`)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this part?")) {
      console.log("Delete part:", id)
    }
  }

  const handleView = (id: string) => {
    router.push(`/admin/parts/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading parts..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Parts Inventory</h1>
          <p className="text-muted-foreground">Manage parts and inventory across VIC centers</p>
        </div>
        <Button onClick={() => router.push("/admin/parts/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Part
        </Button>
      </div>

      <PartTable
        parts={parts}
        totalCount={parts.length}
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
