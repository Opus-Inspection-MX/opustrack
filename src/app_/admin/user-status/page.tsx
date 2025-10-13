"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserStatusTable } from "@/components/user-status/user-status-table"
import { Spinner } from "@/components/ui/spinner"

// Mock data - replace with actual API calls
const mockUserStatuses = [
  {
    id: 1,
    name: "Active",
    active: true,
    userCount: 45,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    name: "Inactive",
    active: true,
    userCount: 12,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 3,
    name: "Suspended",
    active: true,
    userCount: 3,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 4,
    name: "Pending",
    active: true,
    userCount: 8,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
]

export default function UserStatusPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [userStatuses] = useState(mockUserStatuses)

  const handleEdit = (id: number) => {
    router.push(`/admin/user-status/${id}/edit`)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this user status?")) {
      setIsLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setIsLoading(false)
      alert("User status deleted successfully!")
    }
  }

  const handleView = (id: number) => {
    router.push(`/admin/user-status/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading user statuses..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Status</h1>
          <p className="text-muted-foreground">Manage user status types and their configurations</p>
        </div>
        <Button onClick={() => router.push("/admin/user-status/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New User Status
        </Button>
      </div>

      <UserStatusTable data={userStatuses} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} />
    </div>
  )
}
