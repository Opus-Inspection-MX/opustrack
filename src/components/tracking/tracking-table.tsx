"use client";

import type { SortingState } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Edit,
  Eye,
  Lock,
  MoreHorizontal,
  Plus,
  Save,
  User,
  X as XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createAssignment } from "@/lib/actions/assignments";
import { getEquipmentsByLineId } from "@/lib/actions/equipments";
import { updateIncidentFsrs } from "@/lib/actions/incidents";
import { getLinesByVicId } from "@/lib/actions/lines";
import {
  updateAssignmentAssignees,
  updateAssignmentDetails,
  updateIncidentDetails,
} from "@/lib/actions/tracking";

const assignmentStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En Progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const assignmentStatusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

// Utility function to convert hex color to rgba for background
const hexToRgba = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

interface TrackingAssignment {
  id: string;
  status?: { id: number; name: string } | null;
  statusId?: number | null;
  assignees?: Array<{
    user: { id: string; name: string; email?: string };
  }>;
  folio?: number | null;
  notes?: string | null;
  lineId?: number | null;
  equipmentId?: number | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  seenAt?: Date | string | null;
  assignedAt?: Date | string | null;
  createdAt?: Date | string;
}

interface TrackingIncident {
  id: number;
  title: string;
  description?: string | null;
  priority: number;
  reportedAt: Date | string;
  resolvedAt?: Date | string | null;
  statusId?: number | null;
  status?: { id: number; name: string; color: string } | null;
  type?: { id: number; name: string } | null;
  vic?: { id: string; name: string; code: string } | null;
  reportedBy?: { id: string; name: string } | null;
  assignees?: Array<{ user: { id: string; name: string; email?: string } }>;
  assignments: TrackingAssignment[];
  lineId?: number | null;
  equipmentId?: number | null;
  line?: { id: number; name: string } | null;
  equipment?: { id: number; name: string } | null;
}

interface IncidentEditForm {
  title?: string;
  description?: string | null;
  priority?: number;
  statusId?: number | string;
  lineId?: number | string;
  equipmentId?: number | string;
  reportedAt?: string;
  resolvedAt?: string | null;
  assigneeIds?: string[];
}

interface AssignmentEditForm {
  assignedToId?: string;
  notes?: string;
  statusId?: number | string;
  lineId?: number;
  equipmentId?: number;
  startedAt?: string;
  finishedAt?: string;
}

interface LineOption {
  id: number;
  name: string;
}

interface EquipmentOption {
  id: number;
  name: string;
}

interface TrackingTableProps {
  incidents: TrackingIncident[];
  fsrsByVic: Record<string, Array<{ id: string; name: string; email: string }>>;
  incidentStatuses: Array<{ id: number; name: string; color: string }>;
  onDataChange?: () => void;
}

export function TrackingTable({
  incidents,
  fsrsByVic,
  incidentStatuses,
  onDataChange,
}: TrackingTableProps) {
  const _router = useRouter();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingAssignment, setEditingAssignment] = useState<string | null>(
    null,
  );
  const [assignmentEditForm, setAssignmentEditForm] =
    useState<AssignmentEditForm>({});
  const [savingAssignment, setSavingAssignment] = useState<string | null>(null);
  const [editingIncident, setEditingIncident] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<IncidentEditForm>({});
  const [savingIncident, setSavingIncident] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [creatingAssignment, setCreatingAssignment] = useState<number | null>(
    null,
  );
  const [newAssignmentForm, setNewAssignmentForm] =
    useState<AssignmentEditForm>({});
  const [savingNewAssignment, setSavingNewAssignment] = useState(false);
  const [linesForEdit, setLinesForEdit] = useState<LineOption[]>([]);
  const [equipmentsForEdit, setEquipmentsForEdit] = useState<EquipmentOption[]>(
    [],
  );

  // Sort incidents based on sorting state
  const sortedIncidents = useMemo(() => {
    if (sorting.length === 0) return incidents;

    const sorted = [...incidents];
    const { id, desc } = sorting[0];

    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (id) {
        case "cliente":
          aValue = a.vic?.name || "";
          bValue = b.vic?.name || "";
          break;
        case "incidente":
          aValue = a.title || "";
          bValue = b.title || "";
          break;
        case "tipo":
          aValue = a.type?.name || "";
          bValue = b.type?.name || "";
          break;
        case "fechaInicio":
          aValue = new Date(a.reportedAt).getTime();
          bValue = new Date(b.reportedAt).getTime();
          break;
        case "fechaFin":
          aValue = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
          bValue = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
          break;
        case "status":
          aValue = a.status?.name || "";
          bValue = b.status?.name || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return desc ? 1 : -1;
      if (aValue > bValue) return desc ? -1 : 1;
      return 0;
    });

    return sorted;
  }, [incidents, sorting]);

  const handleSort = (columnId: string) => {
    setSorting((old) => {
      const existing = old.find((s) => s.id === columnId);
      if (!existing) {
        return [{ id: columnId, desc: false }];
      }
      if (!existing.desc) {
        return [{ id: columnId, desc: true }];
      }
      return [];
    });
  };

  const getSortIcon = (columnId: string) => {
    const sort = sorting.find((s) => s.id === columnId);
    if (!sort) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sort.desc ? (
      <ArrowDown className="ml-2 h-4 w-4" />
    ) : (
      <ArrowUp className="ml-2 h-4 w-4" />
    );
  };

  const toggleRowExpansion = (incidentId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(incidentId)) {
      newExpanded.delete(incidentId);
    } else {
      newExpanded.add(incidentId);
    }
    setExpandedRows(newExpanded);
  };

  const handleEditAssignment = (assignment: TrackingAssignment) => {
    setEditingAssignment(assignment.id);
    // Format datetime for datetime-local input (YYYY-MM-DDTHH:mm)
    const startedDateTime = assignment.startedAt
      ? new Date(assignment.startedAt).toISOString().slice(0, 16)
      : "";
    const finishedDateTime = assignment.finishedAt
      ? new Date(assignment.finishedAt).toISOString().slice(0, 16)
      : "";
    setAssignmentEditForm({
      assignedToId: assignment.assignees?.[0]?.user.id || "",
      statusId: assignment.status?.id,
      startedAt: startedDateTime || undefined,
      finishedAt: finishedDateTime || undefined,
    });
  };

  const handleCancelAssignmentEdit = (_assignmentId: string) => {
    setEditingAssignment(null);
    setAssignmentEditForm({});
  };

  const handleSaveAssignment = async (assignmentId: string) => {
    if (!assignmentEditForm.assignedToId) {
      alert("Por favor selecciona un FSR");
      return;
    }

    setSavingAssignment(assignmentId);
    try {
      const statusIdValue = assignmentEditForm.statusId
        ? typeof assignmentEditForm.statusId === "string"
          ? parseInt(assignmentEditForm.statusId, 10)
          : assignmentEditForm.statusId
        : null;

      await updateAssignmentDetails(assignmentId, {
        statusId: statusIdValue,
        startedAt: assignmentEditForm.startedAt || null,
        finishedAt: assignmentEditForm.finishedAt || null,
      });
      if (assignmentEditForm.assignedToId) {
        await updateAssignmentAssignees(assignmentId, [
          assignmentEditForm.assignedToId,
        ]);
      }
      setEditingAssignment(null);
      setAssignmentEditForm({});
      // Reload the incidents data to reflect the change
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error("Error updating asignación:", error);
      alert("Error al actualizar asignación");
    } finally {
      setSavingAssignment(null);
    }
  };

  const handleEditIncident = async (incident: TrackingIncident) => {
    setEditingIncident(incident.id);
    // Format datetime for datetime-local input (YYYY-MM-DDTHH:mm)
    const reportedDateTime = new Date(incident.reportedAt)
      .toISOString()
      .slice(0, 16);
    const resolvedDateTime = incident.resolvedAt
      ? new Date(incident.resolvedAt).toISOString().slice(0, 16)
      : "";
    setEditForm({
      title: incident.title,
      description: incident.description,
      reportedAt: reportedDateTime,
      resolvedAt: resolvedDateTime,
      statusId: incident.status?.id || "",
      lineId: incident.lineId || "",
      equipmentId: incident.equipmentId || "",
      assigneeIds: incident.assignees?.map((a) => a.user.id) ?? [],
    });

    // Load lines for the incident's VIC
    if (incident.vic?.id) {
      try {
        const lines = await getLinesByVicId(incident.vic.id);
        setLinesForEdit(lines);

        // Load equipments for the incident's line
        if (incident.lineId) {
          const equipments = await getEquipmentsByLineId(incident.lineId);
          setEquipmentsForEdit(equipments);
        } else {
          setEquipmentsForEdit([]);
        }
      } catch (error) {
        console.error("Error loading lines/equipments:", error);
        setLinesForEdit([]);
        setEquipmentsForEdit([]);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingIncident(null);
    setEditForm({});
    setLinesForEdit([]);
    setEquipmentsForEdit([]);
  };

  const handleLineChange = async (lineId: string) => {
    const actualLineId = lineId === "none" ? "" : lineId;
    setEditForm({ ...editForm, lineId: actualLineId, equipmentId: "" });

    if (actualLineId) {
      try {
        const equipments = await getEquipmentsByLineId(
          parseInt(actualLineId, 10),
        );
        setEquipmentsForEdit(equipments);
      } catch (error) {
        console.error("Error loading equipments:", error);
        setEquipmentsForEdit([]);
      }
    } else {
      setEquipmentsForEdit([]);
    }
  };

  const handleStartCreateAssignment = (incidentId: number) => {
    setCreatingAssignment(incidentId);
    setNewAssignmentForm({
      assignedToId: "",
      notes: "",
    });
  };

  const handleCancelCreateAssignment = () => {
    setCreatingAssignment(null);
    setNewAssignmentForm({});
  };

  const handleCreateAssignment = async (incidentId: number) => {
    // FSR es opcional al crear: el state machine pone PENDIENTE_DE_ASIGNACION
    // si no hay FSR o ASIGNADO si se eligió uno. El statusId lo decide el
    // server, por eso no lo enviamos.
    setSavingNewAssignment(true);
    try {
      await createAssignment({
        incidentId,
        assigneeIds: newAssignmentForm.assignedToId
          ? [newAssignmentForm.assignedToId]
          : [],
        notes: newAssignmentForm.notes || undefined,
        statusId: null,
        startedAt: null,
        finishedAt: null,
      });
      setCreatingAssignment(null);
      setNewAssignmentForm({});
      // Reload the incidents data to reflect the change
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error("Error creating asignación:", error);
      alert("Error al crear la asignación");
    } finally {
      setSavingNewAssignment(false);
    }
  };

  const handleSaveIncident = async (incidentId: number) => {
    setSavingIncident(true);
    try {
      const statusIdValue = editForm.statusId
        ? typeof editForm.statusId === "string"
          ? parseInt(editForm.statusId, 10)
          : editForm.statusId
        : null;
      const lineIdValue = editForm.lineId
        ? typeof editForm.lineId === "string"
          ? parseInt(editForm.lineId, 10)
          : editForm.lineId
        : null;
      const equipmentIdValue = editForm.equipmentId
        ? typeof editForm.equipmentId === "string"
          ? parseInt(editForm.equipmentId, 10)
          : editForm.equipmentId
        : null;

      await updateIncidentDetails(incidentId, {
        title: editForm.title || "",
        description: editForm.description || "",
        reportedAt: editForm.reportedAt || "",
        resolvedAt: editForm.resolvedAt || null,
        statusId: statusIdValue ?? 0,
        lineId: lineIdValue,
        equipmentId: equipmentIdValue,
      });
      if (editForm.assigneeIds !== undefined) {
        await updateIncidentFsrs(incidentId, editForm.assigneeIds);
      }
      setEditingIncident(null);
      setEditForm({});
      setLinesForEdit([]);
      setEquipmentsForEdit([]);
      // Reload the incidents data to reflect the change
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error("Error updating incident:", error);
      alert("Error al actualizar incidente");
    } finally {
      setSavingIncident(false);
    }
  };

  const formatDate = (dateValue: Date | string) => {
    const date =
      typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    return date.toLocaleDateString("es-MX");
  };

  const formatTime = (dateValue: Date | string) => {
    const date =
      typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    return date.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAssignedFSRs = (
    incident: TrackingIncident,
  ): Array<{ id: string; name: string; fromAssignment: boolean }> => {
    const fromWorkOrders = (incident.assignments ?? []).flatMap(
      (wo: TrackingAssignment) =>
        wo.assignees?.map((aa) => ({
          id: aa.user.id,
          name: aa.user.name,
          fromAssignment: true,
        })) ?? [],
    );
    const fromIncident = (incident.assignees ?? []).map((a) => ({
      id: a.user.id,
      name: a.user.name,
      fromAssignment: false,
    }));
    // Work-order FSRs (actively working) win over habilitados — dedupe by id.
    const merged = [...fromWorkOrders, ...fromIncident];
    return merged.filter(
      (fsr, index, self) => index === self.findIndex((f) => f.id === fsr.id),
    );
  };

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("cliente")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                CVV
                {getSortIcon("cliente")}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("incidente")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Incidente
                {getSortIcon("incidente")}
              </Button>
            </TableHead>
            <TableHead>Folio</TableHead>
            <TableHead>Línea</TableHead>
            <TableHead>FSR Asignado</TableHead>
            <TableHead>Folio Asignaciones</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("tipo")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Tipo de Incidente
                {getSortIcon("tipo")}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("fechaInicio")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Fecha Inicio
                {getSortIcon("fechaInicio")}
              </Button>
            </TableHead>
            <TableHead>Hora Inicio</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("fechaFin")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Fecha Fin
                {getSortIcon("fechaFin")}
              </Button>
            </TableHead>
            <TableHead>Hora Fin</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("status")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Status
                {getSortIcon("status")}
              </Button>
            </TableHead>
            <TableHead>Observaciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIncidents.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={14}
                className="text-center py-8 text-muted-foreground"
              >
                No se encontraron incidentes
              </TableCell>
            </TableRow>
          ) : (
            sortedIncidents.map((incident) => {
              const assignedFSRs = getAssignedFSRs(incident);
              const availableFSRs = incident.vic?.id
                ? fsrsByVic[incident.vic.id] || []
                : [];
              const isExpanded = expandedRows.has(incident.id);

              // Get status color for row background
              const statusColor = incident.status?.color || "#6B7280";
              const rowStyle = {
                backgroundColor: hexToRgba(statusColor, 0.1),
                borderLeft: `4px solid ${statusColor}`,
              };

              return (
                <React.Fragment key={incident.id}>
                  <TableRow
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                    style={rowStyle}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(incident.id)}
                        className="p-0 h-6 w-6"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      <Badge variant="outline">
                        {incident.vic?.name || "Sin CVV"} (
                        {incident.vic?.code || "N/A"})
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      <div className="font-medium">{incident.title}</div>
                    </TableCell>
                    <TableCell
                      onClick={() => toggleRowExpansion(incident.id)}
                      className="font-mono text-sm whitespace-nowrap"
                    >
                      INC-{incident.id}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      {incident.line?.name ? (
                        <span className="text-sm">{incident.line.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      {assignedFSRs.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {assignedFSRs.map((fsr) => (
                            <div
                              key={fsr.id}
                              className="flex items-center gap-2"
                              title={
                                fsr.fromAssignment
                                  ? "Asignado a una orden"
                                  : "Habilitado, sin orden todavía"
                              }
                            >
                              <User className="h-3 w-3" />
                              <span className="text-sm">{fsr.name}</span>
                              {!fsr.fromAssignment && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0"
                                >
                                  Habilitado
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sin asignar
                        </span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      {incident.assignments &&
                      incident.assignments.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {incident.assignments.map((wo: TrackingAssignment) =>
                            wo.folio ? (
                              <Badge
                                key={wo.id}
                                variant="outline"
                                className="text-xs"
                              >
                                AS-{wo.folio}
                              </Badge>
                            ) : null,
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      <Badge variant="secondary">
                        {incident.type?.name || "Sin tipo"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      {formatDate(incident.reportedAt)}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      {formatTime(incident.reportedAt)}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      {incident.resolvedAt
                        ? formatDate(incident.resolvedAt)
                        : "-"}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      {incident.resolvedAt
                        ? formatTime(incident.resolvedAt)
                        : "-"}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      <Badge
                        style={{
                          backgroundColor: statusColor,
                          color: "#FFFFFF",
                          borderColor: statusColor,
                        }}
                      >
                        {incident.status?.name || "Sin estado"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      <div className="max-w-xs truncate text-sm text-muted-foreground">
                        {incident.description}
                      </div>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={14} className="bg-muted/30">
                        <div className="p-4 space-y-4">
                          {/* Actions Menu */}
                          <div className="flex items-center justify-between pb-4 border-b">
                            <h4 className="font-semibold">
                              Detalles del Incidente
                            </h4>
                            <div className="flex items-center gap-2">
                              {editingIncident === incident.id ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    disabled={savingIncident}
                                  >
                                    <XIcon className="h-4 w-4 mr-2" />
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleSaveIncident(incident.id)
                                    }
                                    disabled={savingIncident}
                                  >
                                    <Save className="h-4 w-4 mr-2" />
                                    {savingIncident
                                      ? "Guardando..."
                                      : "Guardar"}
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditIncident(incident)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edición Rápida
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                        Acciones
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem asChild>
                                        <Link
                                          href={`/admin/incidents/${incident.id}`}
                                        >
                                          <Eye className="h-4 w-4 mr-2" />
                                          Ver Incidente
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link
                                          href={`/admin/incidents/${incident.id}/edit`}
                                        >
                                          <Edit className="h-4 w-4 mr-2" />
                                          Edición Completa
                                        </Link>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </>
                              )}
                            </div>
                          </div>

                          {editingIncident === incident.id ? (
                            <>
                              <div className="space-y-4 p-4 bg-background rounded-lg border">
                                <h5 className="font-semibold">
                                  Editar Incidente
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="title">
                                      Nombre del Incidente
                                    </Label>
                                    <Input
                                      id="title"
                                      value={editForm.title}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          title: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="statusId">Status</Label>
                                    <Select
                                      value={
                                        editForm.statusId?.toString() || ""
                                      }
                                      onValueChange={(value) =>
                                        setEditForm({
                                          ...editForm,
                                          statusId: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger id="statusId">
                                        <SelectValue placeholder="Seleccionar status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {incidentStatuses.map((status) => (
                                          <SelectItem
                                            key={status.id}
                                            value={status.id.toString()}
                                          >
                                            {status.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="lineId">Línea</Label>
                                    <Select
                                      value={
                                        editForm.lineId?.toString() || "none"
                                      }
                                      onValueChange={handleLineChange}
                                    >
                                      <SelectTrigger id="lineId">
                                        <SelectValue placeholder="Seleccionar línea" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">
                                          Sin línea
                                        </SelectItem>
                                        {linesForEdit.map((line) => (
                                          <SelectItem
                                            key={line.id}
                                            value={line.id.toString()}
                                          >
                                            {line.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="equipmentId">Equipo</Label>
                                    <Select
                                      value={
                                        editForm.equipmentId?.toString() ||
                                        "none"
                                      }
                                      onValueChange={(value) =>
                                        setEditForm({
                                          ...editForm,
                                          equipmentId:
                                            value === "none" ? "" : value,
                                        })
                                      }
                                      disabled={
                                        !editForm.lineId ||
                                        equipmentsForEdit.length === 0
                                      }
                                    >
                                      <SelectTrigger id="equipmentId">
                                        <SelectValue
                                          placeholder={
                                            !editForm.lineId
                                              ? "Selecciona una línea primero"
                                              : "Seleccionar equipo"
                                          }
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">
                                          Sin equipo
                                        </SelectItem>
                                        {equipmentsForEdit.map((equipment) => (
                                          <SelectItem
                                            key={equipment.id}
                                            value={equipment.id.toString()}
                                          >
                                            {equipment.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor={`fsrs-${incident.id}`}>
                                      FSRs habilitados
                                    </Label>
                                    <MultiSelect
                                      options={availableFSRs.map((f) => ({
                                        value: f.id,
                                        label: f.name,
                                        sublabel: f.email,
                                      }))}
                                      value={editForm.assigneeIds ?? []}
                                      onValueChange={(ids) =>
                                        setEditForm({
                                          ...editForm,
                                          assigneeIds: ids,
                                        })
                                      }
                                      placeholder={
                                        incident.vic?.id
                                          ? "Seleccionar FSRs habilitados"
                                          : "Sin CVV — no se pueden listar FSRs"
                                      }
                                      searchPlaceholder="Buscar FSR..."
                                      emptyMessage={
                                        availableFSRs.length === 0
                                          ? "No hay FSRs disponibles para este CVV"
                                          : "Sin resultados"
                                      }
                                      disabled={!incident.vic?.id}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Solo estos FSRs podrán tomar la asignación
                                      generada de este incidente.
                                    </p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="reportedAt">
                                      Fecha y Hora de Inicio
                                    </Label>
                                    <Input
                                      id="reportedAt"
                                      type="datetime-local"
                                      value={editForm.reportedAt}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          reportedAt: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="resolvedAt">
                                      Fecha y Hora de Fin
                                    </Label>
                                    <Input
                                      id="resolvedAt"
                                      type="datetime-local"
                                      value={editForm.resolvedAt || ""}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          resolvedAt: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="description">
                                    Observaciones
                                  </Label>
                                  <Textarea
                                    id="description"
                                    rows={4}
                                    value={editForm.description || ""}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        description: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              {/* Create Assignment in Edit Mode */}
                              <div className="p-4 bg-muted/50 rounded-lg border border-dashed space-y-4">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-semibold">
                                    Crear Asignación
                                  </h5>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleStartCreateAssignment(incident.id)
                                    }
                                    disabled={
                                      creatingAssignment === incident.id
                                    }
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nueva Asignación
                                  </Button>
                                </div>

                                {creatingAssignment === incident.id && (
                                  <div className="p-4 bg-background rounded-lg border space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label
                                          htmlFor={`edit-mode-fsr-${incident.id}`}
                                        >
                                          FSR Asignado *
                                        </Label>
                                        <Select
                                          value={newAssignmentForm.assignedToId}
                                          onValueChange={(value) =>
                                            setNewAssignmentForm({
                                              ...newAssignmentForm,
                                              assignedToId: value,
                                            })
                                          }
                                        >
                                          <SelectTrigger
                                            id={`edit-mode-fsr-${incident.id}`}
                                          >
                                            <SelectValue placeholder="Seleccionar FSR" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(
                                              fsrsByVic[
                                                incident.vic?.id || ""
                                              ] || []
                                            ).map(
                                              (fsr: {
                                                id: string;
                                                name: string;
                                                email?: string;
                                              }) => (
                                                <SelectItem
                                                  key={fsr.id}
                                                  value={fsr.id}
                                                >
                                                  {fsr.name} - {fsr.email}
                                                </SelectItem>
                                              ),
                                            )}
                                          </SelectContent>
                                        </Select>
                                        {(
                                          fsrsByVic[incident.vic?.id || ""] ||
                                          []
                                        ).length === 0 && (
                                          <p className="text-xs text-muted-foreground">
                                            No hay FSRs disponibles para este
                                            CVV
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`edit-mode-notes-${incident.id}`}
                                      >
                                        Notas
                                      </Label>
                                      <Textarea
                                        id={`edit-mode-notes-${incident.id}`}
                                        value={newAssignmentForm.notes}
                                        onChange={(e) =>
                                          setNewAssignmentForm({
                                            ...newAssignmentForm,
                                            notes: e.target.value,
                                          })
                                        }
                                        placeholder="Notas opcionales..."
                                        rows={3}
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelCreateAssignment}
                                        disabled={savingNewAssignment}
                                      >
                                        <XIcon className="h-4 w-4 mr-2" />
                                        Cancelar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleCreateAssignment(incident.id)
                                        }
                                        disabled={savingNewAssignment}
                                      >
                                        <Save className="h-4 w-4 mr-2" />
                                        {savingNewAssignment
                                          ? "Guardando..."
                                          : "Crear Asignación"}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium text-muted-foreground">
                                      Fecha Inicio:
                                    </span>
                                    <p>
                                      {formatDate(incident.reportedAt)} -{" "}
                                      {formatTime(incident.reportedAt)}
                                    </p>
                                  </div>
                                  {incident.resolvedAt && (
                                    <div>
                                      <span className="font-medium text-muted-foreground">
                                        Fecha Fin:
                                      </span>
                                      <p>
                                        {formatDate(incident.resolvedAt)} -{" "}
                                        {formatTime(incident.resolvedAt)}
                                      </p>
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium text-muted-foreground">
                                      Status:
                                    </span>
                                    <div className="mt-1">
                                      <Badge
                                        style={{
                                          backgroundColor:
                                            incident.status?.color || "#6B7280",
                                          color: "#FFFFFF",
                                        }}
                                      >
                                        {incident.status?.name || "Sin estado"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="font-medium text-muted-foreground">
                                      Tipo:
                                    </span>
                                    <p>{incident.type?.name || "Sin tipo"}</p>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2">
                                  Observaciones Completas
                                </h4>
                                <p className="text-sm">
                                  {incident.description}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Assignments Section */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">Asignaciones</h4>
                              {creatingAssignment !== incident.id && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleStartCreateAssignment(incident.id)
                                  }
                                  disabled={editingIncident === incident.id}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Crear Asignación
                                </Button>
                              )}
                            </div>

                            {/* Create Assignment Form */}
                            {creatingAssignment === incident.id && (
                              <div className="p-4 bg-background rounded-lg border space-y-4 mb-3">
                                <h5 className="font-medium">
                                  Nueva Asignación
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor={`new-fsr-${incident.id}`}>
                                      FSR Asignado *
                                    </Label>
                                    <Select
                                      value={newAssignmentForm.assignedToId}
                                      onValueChange={(value) =>
                                        setNewAssignmentForm({
                                          ...newAssignmentForm,
                                          assignedToId: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger
                                        id={`new-fsr-${incident.id}`}
                                      >
                                        <SelectValue placeholder="Seleccionar FSR" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(
                                          fsrsByVic[incident.vic?.id || ""] ||
                                          []
                                        ).map(
                                          (fsr: {
                                            id: string;
                                            name: string;
                                            email?: string;
                                          }) => (
                                            <SelectItem
                                              key={fsr.id}
                                              value={fsr.id}
                                            >
                                              {fsr.name} - {fsr.email}
                                            </SelectItem>
                                          ),
                                        )}
                                      </SelectContent>
                                    </Select>
                                    {(fsrsByVic[incident.vic?.id || ""] || [])
                                      .length === 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        No hay FSRs disponibles para este CVV
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`new-notes-${incident.id}`}>
                                    Notas
                                  </Label>
                                  <Textarea
                                    id={`new-notes-${incident.id}`}
                                    value={newAssignmentForm.notes}
                                    onChange={(e) =>
                                      setNewAssignmentForm({
                                        ...newAssignmentForm,
                                        notes: e.target.value,
                                      })
                                    }
                                    placeholder="Notas opcionales..."
                                    rows={3}
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelCreateAssignment}
                                    disabled={savingNewAssignment}
                                  >
                                    <XIcon className="h-4 w-4 mr-2" />
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleCreateAssignment(incident.id)
                                    }
                                    disabled={savingNewAssignment}
                                  >
                                    <Save className="h-4 w-4 mr-2" />
                                    {savingNewAssignment
                                      ? "Guardando..."
                                      : "Crear Asignación"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Existing Assignments */}
                            {incident.assignments &&
                              incident.assignments.length > 0 && (
                                <div className="space-y-3">
                                  {incident.assignments.map(
                                    (assignment: TrackingAssignment) => (
                                      <div
                                        key={assignment.id}
                                        className="p-4 bg-background rounded-lg border space-y-3"
                                      >
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="flex-1 space-y-2">
                                            {editingAssignment !==
                                              assignment.id && (
                                              <div className="flex items-center gap-2 flex-wrap">
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
                                                      ] ||
                                                      assignment.status.name
                                                    : "Sin estado"}
                                                </Badge>
                                                {assignment.seenAt ? (
                                                  <Badge
                                                    variant="outline"
                                                    className="bg-green-50 text-green-700 border-green-300"
                                                  >
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    Desbloqueado
                                                  </Badge>
                                                ) : (
                                                  <Badge
                                                    variant="outline"
                                                    className="bg-yellow-50 text-yellow-700 border-yellow-300"
                                                  >
                                                    <Lock className="h-3 w-3 mr-1" />
                                                    No Desbloqueado
                                                  </Badge>
                                                )}
                                                {assignment.createdAt && (
                                                  <span className="text-sm text-muted-foreground">
                                                    Creado:{" "}
                                                    {formatDate(
                                                      assignment.createdAt,
                                                    )}{" "}
                                                    -{" "}
                                                    {formatTime(
                                                      assignment.createdAt,
                                                    )}
                                                  </span>
                                                )}
                                              </div>
                                            )}

                                            {editingAssignment !==
                                              assignment.id && (
                                              <>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-medium min-w-[100px]">
                                                    Fecha Inicio:
                                                  </span>
                                                  <span className="text-sm text-muted-foreground">
                                                    {assignment.startedAt
                                                      ? `${formatDate(assignment.startedAt)} - ${formatTime(assignment.startedAt)}`
                                                      : "-"}
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-medium min-w-[100px]">
                                                    Fecha Fin:
                                                  </span>
                                                  <span className="text-sm text-muted-foreground">
                                                    {assignment.finishedAt
                                                      ? `${formatDate(assignment.finishedAt)} - ${formatTime(assignment.finishedAt)}`
                                                      : "-"}
                                                  </span>
                                                </div>
                                              </>
                                            )}

                                            {assignment.folio && (
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium min-w-[100px]">
                                                  Folio:
                                                </span>
                                                <Badge
                                                  variant="outline"
                                                  className="text-sm"
                                                >
                                                  AS-{assignment.folio}
                                                </Badge>
                                              </div>
                                            )}

                                            {editingAssignment !==
                                              assignment.id && (
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium min-w-[100px]">
                                                  FSR Asignado:
                                                </span>
                                                <span className="text-sm">
                                                  <User className="h-4 w-4 inline mr-2" />
                                                  {assignment.assignees
                                                    ?.map((a) => a.user.name)
                                                    .join(", ") ||
                                                    "Sin asignar"}
                                                </span>
                                              </div>
                                            )}

                                            {editingAssignment ===
                                              assignment.id && (
                                              <div className="space-y-3 pt-3 border-t">
                                                <h5 className="font-semibold text-sm">
                                                  Editar Asignación
                                                </h5>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                  <div className="space-y-2">
                                                    <Label
                                                      htmlFor={`wo-fsr-${assignment.id}`}
                                                    >
                                                      FSR Asignado
                                                    </Label>
                                                    <Select
                                                      value={
                                                        assignmentEditForm.assignedToId
                                                      }
                                                      onValueChange={(value) =>
                                                        setAssignmentEditForm({
                                                          ...assignmentEditForm,
                                                          assignedToId: value,
                                                        })
                                                      }
                                                    >
                                                      <SelectTrigger
                                                        id={`wo-fsr-${assignment.id}`}
                                                      >
                                                        <SelectValue placeholder="Seleccionar FSR" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {availableFSRs.map(
                                                          (fsr) => (
                                                            <SelectItem
                                                              key={fsr.id}
                                                              value={fsr.id}
                                                            >
                                                              {fsr.name}
                                                            </SelectItem>
                                                          ),
                                                        )}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      htmlFor={`wo-status-${assignment.id}`}
                                                    >
                                                      Estado
                                                    </Label>
                                                    <Select
                                                      value={
                                                        assignmentEditForm.statusId?.toString() ||
                                                        ""
                                                      }
                                                      onValueChange={(value) =>
                                                        setAssignmentEditForm({
                                                          ...assignmentEditForm,
                                                          statusId: value,
                                                        })
                                                      }
                                                    >
                                                      <SelectTrigger
                                                        id={`wo-status-${assignment.id}`}
                                                      >
                                                        <SelectValue placeholder="Seleccionar estado" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {incidentStatuses.map(
                                                          (status) => (
                                                            <SelectItem
                                                              key={status.id}
                                                              value={status.id.toString()}
                                                            >
                                                              {status.name}
                                                            </SelectItem>
                                                          ),
                                                        )}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      htmlFor={`wo-started-${assignment.id}`}
                                                    >
                                                      Fecha y Hora de Inicio
                                                    </Label>
                                                    <Input
                                                      id={`wo-started-${assignment.id}`}
                                                      type="datetime-local"
                                                      value={
                                                        assignmentEditForm.startedAt
                                                      }
                                                      onChange={(e) =>
                                                        setAssignmentEditForm({
                                                          ...assignmentEditForm,
                                                          startedAt:
                                                            e.target.value,
                                                        })
                                                      }
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      htmlFor={`wo-finished-${assignment.id}`}
                                                    >
                                                      Fecha y Hora de Fin
                                                    </Label>
                                                    <Input
                                                      id={`wo-finished-${assignment.id}`}
                                                      type="datetime-local"
                                                      value={
                                                        assignmentEditForm.finishedAt
                                                      }
                                                      onChange={(e) =>
                                                        setAssignmentEditForm({
                                                          ...assignmentEditForm,
                                                          finishedAt:
                                                            e.target.value,
                                                        })
                                                      }
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-2">
                                            {editingAssignment ===
                                            assignment.id ? (
                                              <>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    handleCancelAssignmentEdit(
                                                      assignment.id,
                                                    )
                                                  }
                                                  disabled={
                                                    savingAssignment ===
                                                    assignment.id
                                                  }
                                                >
                                                  <XIcon className="h-4 w-4 mr-2" />
                                                  Cancelar
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  onClick={() =>
                                                    handleSaveAssignment(
                                                      assignment.id,
                                                    )
                                                  }
                                                  disabled={
                                                    savingAssignment ===
                                                    assignment.id
                                                  }
                                                >
                                                  <Save className="h-4 w-4 mr-2" />
                                                  {savingAssignment ===
                                                  assignment.id
                                                    ? "Guardando..."
                                                    : "Guardar"}
                                                </Button>
                                              </>
                                            ) : (
                                              <>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    handleEditAssignment(
                                                      assignment,
                                                    )
                                                  }
                                                >
                                                  <Edit className="h-4 w-4 mr-2" />
                                                  Edición Rápida
                                                </Button>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                    >
                                                      <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                      <Link
                                                        href={`/admin/assignments/${assignment.id}`}
                                                      >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        Ver Asignación
                                                      </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                      <Link
                                                        href={`/admin/assignments/${assignment.id}/edit`}
                                                      >
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Edición Completa
                                                      </Link>
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        {assignment.notes && (
                                          <div className="text-sm pt-2 border-t">
                                            <span className="font-medium">
                                              Notas:
                                            </span>{" "}
                                            {assignment.notes}
                                          </div>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
