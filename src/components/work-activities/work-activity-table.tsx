"use client"

import { useState } from "react"
import { MoreHorizontal, Edit, Trash2, Activity, Wrench, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TablePagination } from "@/components/common/table-pagination"

interface WorkActivity {
  id: string
  description: string
  performedAt: string
  workOrderId: string
  workOrderTitle: string
  partsCount: number
  active: boolean
  createdAt: string
  updatedAt: string
}

interface WorkActivityTableProps {
  data: WorkActivity[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onView: (id: string) => void
}

export function WorkActivityTable({ data, onEdit, onDelete, onView }: WorkActivityTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = data.slice(startIndex, endIndex)
  const totalPages = Math.ceil(data.length / itemsPerPage)

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Work Order</TableHead>
              <TableHead>Performed At</TableHead>
              <TableHead>Parts Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">
                        {activity.description.length > 60
                          ? `${activity.description.substring(0, 60)}...`
                          : activity.description}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{activity.workOrderTitle}</span>
                  </div>
                </TableCell>
                <TableCell>{new Date(activity.performedAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline">{activity.partsCount} parts</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={activity.active ? "default" : "secondary"}>
                    {activity.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(activity.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(activity.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(activity.id)} className="text-red-600">
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
        startIndex={startIndex}
        endIndex={endIndex}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />
    </div>
  )
}
