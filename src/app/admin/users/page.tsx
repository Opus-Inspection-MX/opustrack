"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { UserTable } from "@/components/users/user-table"
import { Plus } from "lucide-react"
import Link from "next/link"

const mockUsers = [
  {
    id: "1",
    name: "Juan Pérez",
    email: "juan.perez@example.com",
    role: { name: "Admin" },
    userStatus: { name: "Activo" },
    vic: { name: "VIC Centro", code: "VIC001" },
    active: true,
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    name: "María García",
    email: "maria.garcia@example.com",
    role: { name: "FSR" },
    userStatus: { name: "Activo" },
    vic: { name: "VIC Norte", code: "VIC002" },
    active: true,
    createdAt: "2024-01-14T09:15:00Z",
  },
  {
    id: "3",
    name: "Carlos López",
    email: "carlos.lopez@example.com",
    role: { name: "Inspector" },
    userStatus: { name: "Inactivo" },
    active: false,
    createdAt: "2024-01-13T14:20:00Z",
  },
]

export default function UsersPage() {
  const [users, setUsers] = useState(mockUsers)

  const handleDelete = (id: string) => {
    if (confirm("¿Está seguro de que desea eliminar este usuario?")) {
      setUsers(users.filter((user) => user.id !== id))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground">Administre los usuarios del sistema y sus permisos</p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Usuario
          </Link>
        </Button>
      </div>

      <UserTable users={users} onDelete={handleDelete} />
    </div>
  )
}
