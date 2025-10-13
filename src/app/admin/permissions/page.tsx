"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PermissionTable } from "@/components/permissions/permission-table"

// Mock data - replace with actual API calls
const mockPermissions = [
  {
    id: 1,
    name: "user.create",
    description: "Create new users in the system",
    active: true,
    roleCount: 3,
  },
  {
    id: 2,
    name: "user.read",
    description: "View user information",
    active: true,
    roleCount: 5,
  },
  {
    id: 3,
    name: "user.update",
    description: "Update user information",
    active: true,
    roleCount: 2,
  },
  {
    id: 4,
    name: "user.delete",
    description: "Delete users from the system",
    active: true,
    roleCount: 1,
  },
  {
    id: 5,
    name: "incident.create",
    description: "Create new incidents",
    active: true,
    roleCount: 4,
  },
  {
    id: 6,
    name: "incident.read",
    description: "View incident information",
    active: true,
    roleCount: 6,
  },
  {
    id: 7,
    name: "workorder.create",
    description: "Create new work orders",
    active: true,
    roleCount: 3,
  },
  {
    id: 8,
    name: "admin.access",
    description: "Access admin panel",
    active: true,
    roleCount: 2,
  },
]

export default function PermissionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const router = useRouter()

  const filteredPermissions = mockPermissions.filter(
    (permission) =>
      permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleEdit = (permission: any) => {
    router.push(`/admin/permissions/${permission.id}/edit`)
  }

  const handleDelete = (permission: any) => {
    if (permission.roleCount > 0) {
      alert(`Cannot delete permission "${permission.name}" because it is assigned to ${permission.roleCount} role(s).`)
      return
    }

    if (confirm(`Are you sure you want to delete the permission "${permission.name}"?`)) {
      console.log("Deleting permission:", permission.id)
      // Implement delete logic
    }
  }

  const handleView = (permission: any) => {
    console.log("Viewing permission:", permission)
    // Implement view logic or navigate to detail page
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Permissions</h1>
          <p className="text-muted-foreground">Manage system permissions</p>
        </div>
        <Button onClick={() => router.push("/admin/permissions/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Permission
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <PermissionTable
        permissions={filteredPermissions}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  )
}
