"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";

const priorityColors = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const statusColors = {
  Open: "bg-blue-100 text-blue-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  Resolved: "bg-green-100 text-green-800",
  Closed: "bg-gray-100 text-gray-800",
};

const workOrderStatusColors = {
  PENDING: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

interface IncidentTableProps {
  incidents: any[];
  onDelete: (id: string) => void;
}

export function IncidentTable({ incidents, onDelete }: IncidentTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const router = useRouter();

  const toggleRowExpansion = (incidentId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(incidentId)) {
      newExpanded.delete(incidentId);
    } else {
      newExpanded.add(incidentId);
    }
    setExpandedRows(newExpanded);
  };

  const handleEdit = (incident: any) => {
    router.push(`/admin/incidents/${incident.id}/edit`);
  };

  const handleCreateWorkOrder = (incident: any) => {
    router.push(`/admin/work-orders/new?incidentId=${incident.id}`);
  };

  const formatDate = (dateString: string) => {
    return (
      new Date(dateString).toLocaleDateString() +
      " " +
      new Date(dateString).toLocaleTimeString()
    );
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>VIC</TableHead>
            <TableHead>Reported By</TableHead>
            <TableHead>Reported At</TableHead>
            <TableHead>SLA (hrs)</TableHead>
            <TableHead>Work Orders</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map(
            (incident: {
              id: string;
              title: string;
              description: string;
              priority: keyof typeof priorityColors;
              status: { name: keyof typeof statusColors };
              type: { name: string };
              vic: { name: string; code: string };
              reportedBy: { name: string };
              reportedAt: string;
              sla: number;
              workOrders: Array<{
                id: string;
                status: keyof typeof workOrderStatusColors;
                assignedTo: { name: string };
                startedAt?: string;
                finishedAt?: string;
              }>;
            }) => (
              <>
                <TableRow key={incident.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRowExpansion(incident.id)}
                      className="p-0 h-6 w-6"
                    >
                      {expandedRows.has(incident.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{incident.title}</div>
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {incident.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={priorityColors[incident.priority]}>
                      {incident.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[incident.status.name]}>
                      {incident.status.name}
                    </Badge>
                  </TableCell>
                  <TableCell>{incident.type.name}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{incident.vic.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {incident.vic.code}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{incident.reportedBy.name}</TableCell>
                  <TableCell className="text-sm">
                    {formatDate(incident.reportedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        incident.sla <= 4
                          ? "destructive"
                          : incident.sla <= 24
                          ? "default"
                          : "secondary"
                      }
                    >
                      {incident.sla}h
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {incident.workOrders.length} WO
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateWorkOrder(incident)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add WO
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(incident)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(incident.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {expandedRows.has(incident.id) && (
                  <TableRow>
                    <TableCell colSpan={11} className="bg-muted/30">
                      <div className="p-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Work Orders ({incident.workOrders.length})
                        </h4>
                        {incident.workOrders.length > 0 ? (
                          <div className="space-y-2">
                            {incident.workOrders.map(
                              (workOrder: {
                                id: string;
                                status: keyof typeof workOrderStatusColors;
                                assignedTo: { name: string };
                                startedAt?: string;
                                finishedAt?: string;
                              }) => (
                                <div
                                  key={workOrder.id}
                                  className="flex items-center justify-between p-3 bg-background rounded-lg border"
                                >
                                  <div className="flex items-center gap-4">
                                    <Badge
                                      className={
                                        workOrderStatusColors[workOrder.status]
                                      }
                                    >
                                      {workOrder.status.replace("_", " ")}
                                    </Badge>
                                    <div>
                                      <div className="font-medium">
                                        WO #{workOrder.id}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        Assigned to: {workOrder.assignedTo.name}
                                      </div>
                                    </div>
                                    <div className="text-sm">
                                      {workOrder.startedAt && (
                                        <div>
                                          Started:{" "}
                                          {formatDate(workOrder.startedAt)}
                                        </div>
                                      )}
                                      {workOrder.finishedAt && (
                                        <div>
                                          Finished:{" "}
                                          {formatDate(workOrder.finishedAt)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() =>
                                          router.push(
                                            `/admin/work-orders/${workOrder.id}/edit`
                                          )
                                        }
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit Work Order
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Work Order
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">
                            No work orders created yet.
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
