"use client"

import { MoreHorizontal, Edit, Trash2, Eye, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TablePagination } from "@/components/common/table-pagination"

interface VICCenter {
  id: string
  code: string
  name: string
  address?: string
  phone?: string
  email?: string
  lines: number
  state: { name: string }
  active: boolean
  createdAt: string
}

interface VICCenterTableProps {
  vicCenters: VICCenter[]
  totalCount: number
  currentPage: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (itemsPerPage: number) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onView: (id: string) => void
}

export function VICCenterTable({
  vicCenters,
  totalCount,
  currentPage,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  onEdit,
  onDelete,
  onView,
}: VICCenterTableProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vicCenters.map((vic) => (
              <TableRow key={vic.id}>
                <TableCell className="font-mono font-medium">{vic.code}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{vic.name}</div>
                    {vic.address && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {vic.address}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{vic.state.name}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{vic.lines} lines</Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {vic.phone && <div>📞 {vic.phone}</div>}
                    {vic.email && <div>✉️ {vic.email}</div>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={vic.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {vic.active ? "Active" : "Inactive"}
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
                      <DropdownMenuItem onClick={() => onView(vic.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(vic.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(vic.id)} className="text-destructive">
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
        totalPages={Math.ceil(totalCount / itemsPerPage)}
        itemsPerPage={itemsPerPage}
        totalItems={totalCount}
        onPageChange={onPageChange}
        onItemsPerPageChange={onItemsPerPageChange}
      />
    </div>
  )
}
