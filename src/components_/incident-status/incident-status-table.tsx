"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, Eye } from "lucide-react"
import { TablePagination } from "@/components/common/table-pagination"

interface IncidentStatus {
  id: number
  name: string
  incidentCount: number
  active: boolean
  createdAt: string
  updatedAt: string
}

interface IncidentStatusTableProps {
  data: IncidentStatus[]
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onView: (id: number) => void
}

const getStatusColor = (name: string) => {
  const lowerName = name.toLowerCase()
  if (lowerName.includes("open") || lowerName.includes("new")) {
    return "bg-red-100 text-red-800"
  }
  if (lowerName.includes("progress") || lowerName.includes("assigned")) {
    return "bg-blue-100 text-blue-800"
  }
  if (lowerName.includes("resolved") || lowerName.includes("closed")) {
    return "bg-green-100 text-green-800"
  }
  if (lowerName.includes("pending") || lowerName.includes("waiting")) {
    return "bg-yellow-100 text-yellow-800"
  }
  return "bg-gray-100 text-gray-800"
}

export function IncidentStatusTable({ data, onEdit, onDelete, onView }: IncidentStatusTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = data.slice(startIndex, endIndex)
  const totalPages = Math.ceil(data.length / itemsPerPage)

  const handleDelete = (id: number, incidentCount: number) => {
    if (incidentCount > 0) {
      alert(`Cannot delete this status. It is being used by ${incidentCount} incident(s).`)
      return
    }

    if (confirm("Are you sure you want to delete this incident status?")) {
      onDelete(id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status Preview</TableHead>
              <TableHead>Incidents</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((status) => (
              <TableRow key={status.id}>
                <TableCell className="font-medium">{status.name}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(status.name)}>{status.name}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{status.incidentCount} incidents</span>
                </TableCell>
                <TableCell>
                  <Badge variant={status.active ? "default" : "secondary"}>
                    {status.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(status.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(status.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(status.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(status.id, status.incidentCount)}
                        className="text-red-600"
                        disabled={status.incidentCount > 0}
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
        totalItems={data.length}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(newItemsPerPage) => {
          setItemsPerPage(newItemsPerPage)
          setCurrentPage(1)
        }}
      />
    </div>
  )
}
