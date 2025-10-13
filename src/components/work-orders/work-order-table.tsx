"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
}

const statusIcons: Record<string, any> = {
  PENDING: Clock,
  IN_PROGRESS: AlertCircle,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
}

const priorityColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
}

interface WorkOrderTableProps {
  workOrders: any[]
  onDelete: (id: string) => void
}

export function WorkOrderTable({ workOrders, onDelete }: WorkOrderTableProps) {
  const router = useRouter()

  const handleEdit = (workOrder: any) => {
    router.push(`/admin/work-orders/${workOrder.id}/edit`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + " " + new Date(dateString).toLocaleTimeString()
  }

  const calculateDuration = (startedAt: string, finishedAt: string | null) => {
    if (!startedAt) return "Not started"
    if (!finishedAt) return "In progress"

    const start = new Date(startedAt)
    const end = new Date(finishedAt)
    const diffMs = end.getTime() - start.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    return `${diffHours}h ${diffMinutes}m`
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Work Order ID</TableHead>
            <TableHead>Related Incident</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Activities</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders.map((workOrder) => {
            const StatusIcon = statusIcons[workOrder.status]
            return (
              <TableRow key={workOrder.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="font-medium">#{workOrder.id}</div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{workOrder.incident.title}</div>
                    <Badge className={priorityColors[workOrder.incident.priority]} variant="outline">
                      {workOrder.incident.priority}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[workOrder.status]}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {workOrder.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{workOrder.assignedTo.name}</div>
                    <div className="text-sm text-muted-foreground">{workOrder.assignedTo.role}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{calculateDuration(workOrder.startedAt, workOrder.finishedAt)}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{workOrder.workActivities.length} activities</Badge>
                </TableCell>
                <TableCell className="text-sm">{formatDate(workOrder.createdAt)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(workOrder)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(workOrder.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
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
  )
}
