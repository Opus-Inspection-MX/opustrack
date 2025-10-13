"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RoleTable } from "@/components/roles/role-table"
import { Spinner } from "@/components/ui/spinner"

// Mock data - replace with actual API calls
const mockRoles = [
  {
    id: 1,
    name: "Admin",
    defaultPath: "/admin",
    active: true,
    _count: { users: 5, rolePermission: 12 },
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    name: "FSR",
    defaultPath: "/fsr",
    active: true,
    _count: { users: 15, rolePermission: 8 },
    createdAt: "2024-01-16T10:00:00Z",
  },
  {
    id: 3,
    name: "Cliente",
    defaultPath: "/client",
    active: true,
    _count: { users: 3, rolePermission: 10 },
    createdAt: "2024-01-17T10:00:00Z",
  },
  {
    id: 4,
    name: "Invitado",
    defaultPath: "/guest",
    active: false,
    _count: { users: 0, rolePermission: 3 },
    createdAt: "2024-01-18T10:00:00Z",
  },
]

export default function RolesPage() {
  const [roles, setRoles] = useState(mockRoles)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const router = useRouter()

  const handleEdit = (id: number) => {
    router.push(`/admin/roles/${id}/edit`)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this role? This action cannot be undone.")) {
      // Implement delete logic
      console.log("Delete role:", id)
    }
  }

  const handleView = (id: number) => {
    router.push(`/admin/roles/${id}`)
  }

  const handleManagePermissions = (id: number) => {
    router.push(`/admin/roles/${id}/permissions`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading roles..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground">Manage user roles and their default access paths</p>
        </div>
        <Button onClick={() => router.push("/admin/roles/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </div>

      <RoleTable
        roles={roles}
        totalCount={roles.length}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onManagePermissions={handleManagePermissions}
      />
    </div>
  )
}
