"use client"

import { useState } from "react"
import { MoreHorizontal, Edit, Trash2, Calendar, Building2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TablePagination } from "@/components/common/table-pagination"

interface Schedule {
  id: string
  title: string
  description?: string
  scheduledAt: string
  vicId: string
  vicName: string
  incidentCount: number
  active: boolean
  createdAt: string
  updatedAt: string
}

interface ScheduleTableProps {
  data: Schedule[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onView: (id: string) => void
}

export function ScheduleTable({ data, onEdit, onDelete, onView }: ScheduleTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = data.slice(startIndex, endIndex)
  const totalPages = Math.ceil(data.length / itemsPerPage)

  const getScheduleStatus = (scheduledAt: string) => {
    const now = new Date()
    const scheduleDate = new Date(scheduledAt)

    if (scheduleDate < now) {
      return { label: "Past", variant: "secondary" as const }
    } else if (scheduleDate.toDateString() === now.toDateString()) {
      return { label: "Today", variant: "default" as const }
    } else {
      return { label: "Upcoming", variant: "outline" as const }
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>VIC Center</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Incidents</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((schedule) => {
              const status = getScheduleStatus(schedule.scheduledAt)
              return (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{schedule.title}</div>
                      {schedule.description && (
                        <div className="text-sm text-muted-foreground">
                          {schedule.description.length > 50
                            ? `${schedule.description.substring(0, 50)}...`
                            : schedule.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{schedule.vicName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(schedule.scheduledAt).toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <span>{schedule.incidentCount}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={schedule.active ? "default" : "secondary"}>
                      {schedule.active ? "Active" : "Inactive"}
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
                        <DropdownMenuItem onClick={() => onView(schedule.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(schedule.id)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(schedule.id)}
                          disabled={schedule.incidentCount > 0}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={data.length}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />
    </div>
  )
}
