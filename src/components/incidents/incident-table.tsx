"use client";

import {
  ChevronDown,
  ChevronRight,
  Edit,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

const priorityColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  Abierto: "bg-blue-100 text-blue-800",
  "En Progreso": "bg-yellow-100 text-yellow-800",
  Resuelto: "bg-green-100 text-green-800",
  Cerrado: "bg-gray-100 text-gray-800",
};

const assignmentStatusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const assignmentStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En Progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

interface AssignmentStatus {
  name: string;
}

interface AssignedUser {
  name: string;
}

interface TableAssignment {
  id: string;
  status?: AssignmentStatus | null;
  assignedTo: AssignedUser;
  startedAt?: string | null;
  finishedAt?: string | null;
}

interface IncidentType {
  name: string;
}

interface IncidentStatus {
  name: string;
}

interface VIC {
  name: string;
  code: string;
}

interface ReportedByUser {
  name: string;
}

interface TableIncident {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: IncidentStatus;
  type: IncidentType;
  vic: VIC;
  reportedBy: ReportedByUser;
  reportedAt: string;
  sla: number;
  assignments: TableAssignment[];
}

interface IncidentTableProps {
  incidents: TableIncident[];
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

  const handleEdit = (incident: TableIncident) => {
    router.push(`/admin/incidents/${incident.id}/edit`);
  };

  const handleCreateAssignment = (incident: TableIncident) => {
    router.push(`/admin/assignments/new?incidentId=${incident.id}`);
  };

  const formatDate = (dateString: string) => {
    return (
      new Date(dateString).toLocaleDateString() +
      " " +
      new Date(dateString).toLocaleTimeString()
    );
  };

  return (
    <div className="overflow-x-auto relative">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Folio</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>CVV</TableHead>
            <TableHead>Reportado Por</TableHead>
            <TableHead>Reportado El</TableHead>
            <TableHead>SLA (hrs)</TableHead>
            <TableHead>Asignaciones</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => (
            <>
              <TableRow key={incident.id} className="hover:bg-muted/50">
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowExpansion(incident.id)}
                    className="p-0 h-6 w-6"
                    type="button"
                  >
                    {expandedRows.has(incident.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="font-mono text-sm whitespace-nowrap">
                  INC-{incident.id}
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
                      {incident.assignments.length} OT
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateAssignment(incident)}
                      type="button"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar OT
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        type="button"
                      >
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                      <DropdownMenuItem onClick={() => handleEdit(incident)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(incident.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              {expandedRows.has(incident.id) && (
                <TableRow>
                  <TableCell colSpan={12} className="bg-muted/30">
                    <div className="p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Asignaciones ({incident.assignments.length})
                      </h4>
                      {incident.assignments.length > 0 ? (
                        <div className="space-y-2">
                          {incident.assignments.map(
                            (assignment: TableAssignment) => (
                              <div
                                key={assignment.id}
                                className="flex items-center justify-between p-3 bg-background rounded-lg border"
                              >
                                <div className="flex items-center gap-4">
                                  <Badge
                                    className={
                                      (assignment.status?.name &&
                                        assignmentStatusColors[
                                          assignment.status.name
                                        ]) ||
                                      "bg-gray-100 text-gray-800"
                                    }
                                  >
                                    {assignment.status?.name
                                      ? assignmentStatusLabels[
                                          assignment.status.name
                                        ] || assignment.status.name
                                      : "Sin estado"}
                                  </Badge>
                                  <div>
                                    <div className="font-medium">
                                      OT #{assignment.id}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      Asignado a: {assignment.assignedTo.name}
                                    </div>
                                  </div>
                                  <div className="text-sm">
                                    {assignment.startedAt && (
                                      <div>
                                        Iniciado:{" "}
                                        {formatDate(assignment.startedAt)}
                                      </div>
                                    )}
                                    {assignment.finishedAt && (
                                      <div>
                                        Finalizado:{" "}
                                        {formatDate(assignment.finishedAt)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      type="button"
                                    >
                                      <span className="sr-only">
                                        Abrir menú
                                      </span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-[200px]"
                                  >
                                    <DropdownMenuItem
                                      onClick={() =>
                                        router.push(
                                          `/admin/assignments/${assignment.id}/edit`,
                                        )
                                      }
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar Asignación
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar Asignación
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          No se han creado asignaciones aún.
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
