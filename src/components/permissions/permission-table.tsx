"use client"

import { useState } from "react"
import { MoreHorizontal, Eye, Edit, Trash2, Shield, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TablePagination } from "@/components/common/table-pagination"

interface Permission {
  id: number
  name: string
  description?: string
  active: boolean
  roleCount: number
}

interface PermissionTableProps {
  permissions: Permission[]
  onEdit: (permission: Permission) => void
  onDelete: (permission: Permission) => void
  onView: (permission: Permission) => void
}

export function PermissionTable({ permissions, onEdit, onDelete, onView }: PermissionTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPermissions = permissions.slice(startIndex, endIndex)
  const totalPages = Math.ceil(permissions.length / itemsPerPage)

  const getCategoryColor = (name: string) => {
    const category = name.split(".")[0]
    const colors: Record<string, string> = {
      user: "bg-blue-100 text-blue-800",
      incident: "bg-red-100 text-red-800",
      workorder: "bg-green-100 text-green-800",
      vic: "bg-purple-100 text-purple-800",
      part: "bg-yellow-100 text-yellow-800",
      admin: "bg-gray-100 text-gray-800",
    }
    return colors[category] || "bg-gray-100 text-gray-800"
  }

  const getCategory = (name: string) => {
    return name.split(".")[0].toUpperCase()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permission</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentPermissions.map((permission) => (
              <TableRow key={permission.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{permission.name}</code>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={getCategoryColor(permission.name)}>
                    {getCategory(permission.name)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="max-w-xs">
                    {permission.description ? (
                      <span className="text-sm text-muted-foreground">
                        {permission.description.length > 50
                          ? `${permission.description.substring(0, 50)}...`
                          : permission.description}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">No description</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{permission.roleCount}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={permission.active ? "default" : "secondary"}>
                    {permission.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(permission)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(permission)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(permission)}
                        className="text-destructive"
                        disabled={permission.roleCount > 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={permissions.length}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(newItemsPerPage) => {
          setItemsPerPage(newItemsPerPage)
          setCurrentPage(1)
        }}
      />
    </div>
  )
}
