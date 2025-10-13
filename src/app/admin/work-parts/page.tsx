"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WorkPartTable } from "@/components/work-parts/work-part-table"
import { WorkPartFilters } from "@/components/work-parts/work-part-filters"
import { Spinner } from "@/components/ui/spinner"

// Mock data - replace with actual API calls
const mockWorkParts = [
  {
    id: "wp_001",
    part: {
      id: "part_001",
      name: "Brake Pad Set",
      price: 89.99,
    },
    quantity: 2,
    description: "Replaced worn brake pads on inspection line 1",
    price: 89.99,
    workOrder: {
      id: "wo_001",
      status: "completed",
      incident: {
        title: "Brake system maintenance required",
      },
    },
    workActivity: {
      id: "wa_001",
      description: "Brake pad replacement and system check",
    },
    createdAt: "2024-01-20T10:00:00Z",
    active: true,
  },
  {
    id: "wp_002",
    part: {
      id: "part_002",
      name: "Oil Filter",
      price: 15.5,
    },
    quantity: 1,
    description: "Regular maintenance oil filter replacement",
    price: 15.5,
    workOrder: {
      id: "wo_002",
      status: "in_progress",
      incident: {
        title: "Routine maintenance - Line 2",
      },
    },
    workActivity: {
      id: "wa_002",
      description: "Oil change and filter replacement",
    },
    createdAt: "2024-01-19T14:30:00Z",
    active: true,
  },
  {
    id: "wp_003",
    part: {
      id: "part_003",
      name: "Air Filter",
      price: 22.75,
    },
    quantity: 3,
    description: "Air filter replacement for improved air quality",
    price: 22.75,
    workOrder: {
      id: "wo_003",
      status: "pending",
      incident: {
        title: "Air quality improvement project",
      },
    },
    createdAt: "2024-01-18T09:15:00Z",
    active: true,
  },
]

export default function WorkPartsPage() {
  const [workParts, setWorkParts] = useState(mockWorkParts)
  const [filteredWorkParts, setFilteredWorkParts] = useState(mockWorkParts)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleFiltersChange = (filters: {
    search: string
    partId: string
    workOrderStatus: string
    active: string
  }) => {
    let filtered = workParts

    if (filters.search) {
      filtered = filtered.filter(
        (wp) =>
          wp.part.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          wp.description?.toLowerCase().includes(filters.search.toLowerCase()),
      )
    }

    if (filters.partId) {
      filtered = filtered.filter((wp) => wp.part.id === filters.partId)
    }

    if (filters.workOrderStatus) {
      filtered = filtered.filter((wp) => wp.workOrder?.status === filters.workOrderStatus)
    }

    if (filters.active) {
      filtered = filtered.filter((wp) => wp.active === (filters.active === "true"))
    }

    setFilteredWorkParts(filtered)
  }

  const handleEdit = (id: string) => {
    router.push(`/admin/work-parts/${id}/edit`)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this work part record?")) {
      setIsLoading(true)
      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000))
        setWorkParts(workParts.filter((wp) => wp.id !== id))
        setFilteredWorkParts(filteredWorkParts.filter((wp) => wp.id !== id))
        alert("Work part deleted successfully!")
      } catch (error) {
        console.error("Error deleting work part:", error)
        alert("Error deleting work part")
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleView = (id: string) => {
    router.push(`/admin/work-parts/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading work parts..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Work Parts</h1>
          <p className="text-muted-foreground">Track parts usage in work orders and activities</p>
        </div>
        <Button onClick={() => router.push("/admin/work-parts/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Work Part
        </Button>
      </div>

      <WorkPartFilters onFiltersChange={handleFiltersChange} />

      <WorkPartTable data={filteredWorkParts} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} />
    </div>
  )
}
