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

interface TableAssignment {
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
  assignmentActivities?: Array<{ id: string }>;
  createdAt: string;
}

interface AssignmentTableProps {
  assignments: TableAssignment[];
  onDelete: (id: string) => void;
}

export function AssignmentTable({
  assignments,
  onDelete,
}: AssignmentTableProps) {
  const router = useRouter();

  const handleEdit = (assignment: TableAssignment) => {
    router.push(`/admin/assignments/${assignment.id}/edit`);
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
            <TableHead>ID Asignación</TableHead>
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
          {assignments.map((assignment) => {
            const _StatusIcon = assignment.status?.name
              ? statusIcons[assignment.status.name]
              : null;
            return (
              <TableRow key={assignment.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="font-medium">#{assignment.id}</div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {assignment.incident.title}
                    </div>
                    <div className="flex gap-1 mt-1">
                      {assignment.incident.type && (
                        <Badge variant="secondary" className="text-xs">
                          {assignment.incident.type.name}
                        </Badge>
                      )}
                      <Badge
                        className={priorityColors[assignment.incident.priority]}
                        variant="outline"
                      >
                        {assignment.incident.priority}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {assignment.status && (
                    <Badge variant="secondary">
                      {statusLabels[assignment.status.name] ||
                        assignment.status.name}
                    </Badge>
                  )}
                  {!assignment.status && (
                    <span className="text-sm text-muted-foreground">
                      Sin estado
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {assignment.assignedTo?.name || "Sin asignar"}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {calculateDuration(
                      assignment.startedAt,
                      assignment.finishedAt,
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {assignment.assignmentActivities?.length || 0} actividades
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(assignment.createdAt)}
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
                      <DropdownMenuItem onClick={() => handleEdit(assignment)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(assignment.id)}
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
