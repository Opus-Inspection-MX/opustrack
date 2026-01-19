"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  MoreHorizontal,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const _statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En Progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const statusIcons: Record<string, LucideIcon> = {
  PENDING: Clock,
  IN_PROGRESS: AlertCircle,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
};

const priorityColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

interface TableWorkOrder {
  id: string;
  status?: { name: string } | null;
  incident: {
    title: string;
    type?: { name: string } | null;
    priority: string;
    vic?: { name: string } | null;
  };
  assignedTo?: { name: string } | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  workActivities?: Array<{ id: string }>;
  createdAt: string;
}

interface WorkOrderTableProps {
  workOrders: TableWorkOrder[];
  onDelete: (id: string) => void;
}

export function WorkOrderTable({ workOrders, onDelete }: WorkOrderTableProps) {
  const router = useRouter();

  const handleEdit = (workOrder: TableWorkOrder) => {
    router.push(`/admin/work-orders/${workOrder.id}/edit`);
  };

  const formatDate = (dateString: string) => {
    return (
      new Date(dateString).toLocaleDateString() +
      " " +
      new Date(dateString).toLocaleTimeString()
    );
  };

  const calculateDuration = (
    startedAt: string | null | undefined,
    finishedAt: string | null | undefined,
  ) => {
    if (!startedAt) return "No iniciado";
    if (!finishedAt) return "En progreso";

    const start = new Date(startedAt);
    const end = new Date(finishedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${diffHours}h ${diffMinutes}m`;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID Orden de Trabajo</TableHead>
            <TableHead>Incidente Relacionado</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Asignado A</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Actividades</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders.map((workOrder) => {
            const _StatusIcon = workOrder.status?.name
              ? statusIcons[workOrder.status.name]
              : null;
            return (
              <TableRow key={workOrder.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="font-medium">#{workOrder.id}</div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {workOrder.incident.title}
                    </div>
                    <div className="flex gap-1 mt-1">
                      {workOrder.incident.type && (
                        <Badge variant="secondary" className="text-xs">
                          {workOrder.incident.type.name}
                        </Badge>
                      )}
                      <Badge
                        className={priorityColors[workOrder.incident.priority]}
                        variant="outline"
                      >
                        {workOrder.incident.priority}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {workOrder.status && (
                    <Badge variant="secondary">
                      {statusLabels[workOrder.status.name] ||
                        workOrder.status.name}
                    </Badge>
                  )}
                  {!workOrder.status && (
                    <span className="text-sm text-muted-foreground">
                      Sin estado
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {workOrder.assignedTo?.name || "Sin asignar"}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {calculateDuration(
                      workOrder.startedAt,
                      workOrder.finishedAt,
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {workOrder.workActivities?.length || 0} actividades
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(workOrder.createdAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(workOrder)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(workOrder.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
