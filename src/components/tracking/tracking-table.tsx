"use client";

import type { SortingState } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Edit,
  Eye,
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
import { getEquipmentsByLineId } from "@/lib/actions/equipments";
import { getLinesByVicId } from "@/lib/actions/lines";
import {
  updateIncidentDetails,
  updateWorkOrderDetails,
} from "@/lib/actions/tracking";
import { createWorkOrder } from "@/lib/actions/work-orders";

const workOrderStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En Progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const workOrderStatusColors: Record<string, string> = {
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

interface TrackingWorkOrder {
  id: string;
  status?: { name: string } | null;
  statusId?: number | null;
  assignedTo?: { id: string; name: string } | null;
  assignedToId?: string;
  folio?: string | null;
  notes?: string | null;
  lineId?: string | null;
  equipmentId?: string | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
}

interface TrackingIncident {
  id: number;
  title: string;
  description?: string | null;
  priority: number;
  sla: number;
  reportedAt: Date | string;
  statusId?: number | null;
  status?: { id: number; name: string; color: string } | null;
  type?: { id: number; name: string } | null;
  vic?: { id: string; name: string; code: string } | null;
  reportedBy?: { id: string; name: string } | null;
  workOrders: TrackingWorkOrder[];
  lineId?: string | null;
  equipmentId?: string | null;
}

interface IncidentEditForm {
  title?: string;
  description?: string;
  priority?: number;
  statusId?: number;
  lineId?: string;
  equipmentId?: string;
}

interface WorkOrderEditForm {
  assignedToId?: string;
  folio?: string;
  notes?: string;
  statusId?: number;
  lineId?: string;
  equipmentId?: string;
}

interface LineOption {
  id: string;
  name: string;
}

interface EquipmentOption {
  id: string;
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
  const [editingWorkOrder, setEditingWorkOrder] = useState<string | null>(null);
  const [workOrderEditForm, setWorkOrderEditForm] = useState<WorkOrderEditForm>(
    {},
  );
  const [savingWorkOrder, setSavingWorkOrder] = useState<string | null>(null);
  const [editingIncident, setEditingIncident] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<IncidentEditForm>({});
  const [savingIncident, setSavingIncident] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [creatingWorkOrder, setCreatingWorkOrder] = useState<number | null>(
    null,
  );
  const [newWorkOrderForm, setNewWorkOrderForm] = useState<WorkOrderEditForm>(
    {},
  );
  const [savingNewWorkOrder, setSavingNewWorkOrder] = useState(false);
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

  const handleEditWorkOrder = (workOrder: TrackingWorkOrder) => {
    setEditingWorkOrder(workOrder.id);
    // Format datetime for datetime-local input (YYYY-MM-DDTHH:mm)
    const startedDateTime = workOrder.startedAt
      ? new Date(workOrder.startedAt).toISOString().slice(0, 16)
      : "";
    const finishedDateTime = workOrder.finishedAt
      ? new Date(workOrder.finishedAt).toISOString().slice(0, 16)
      : "";
    setWorkOrderEditForm({
      assignedToId: workOrder.assignedTo.id,
      statusId: workOrder.status?.id || "",
      startedAt: startedDateTime,
      finishedAt: finishedDateTime,
      folio: workOrder.folio || "",
    });
  };

  const handleCancelWorkOrderEdit = (_workOrderId: string) => {
    setEditingWorkOrder(null);
    setWorkOrderEditForm({});
  };

  const handleSaveWorkOrder = async (workOrderId: string) => {
    if (!workOrderEditForm.assignedToId) {
      alert("Por favor selecciona un FSR");
      return;
    }

    setSavingWorkOrder(workOrderId);
    try {
      await updateWorkOrderDetails(workOrderId, {
        assignedToId: workOrderEditForm.assignedToId,
        statusId: workOrderEditForm.statusId
          ? parseInt(workOrderEditForm.statusId, 10)
          : null,
        startedAt: workOrderEditForm.startedAt || null,
        finishedAt: workOrderEditForm.finishedAt || null,
        folio: workOrderEditForm.folio || null,
      });
      setEditingWorkOrder(null);
      setWorkOrderEditForm({});
      // Reload the incidents data to reflect the change
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error("Error updating work order:", error);
      alert("Error al actualizar orden de trabajo");
    } finally {
      setSavingWorkOrder(null);
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

  const handleStartCreateWorkOrder = (incidentId: number) => {
    setCreatingWorkOrder(incidentId);
    setNewWorkOrderForm({
      assignedToId: "",
      notes: "",
      folio: "",
    });
  };

  const handleCancelCreateWorkOrder = () => {
    setCreatingWorkOrder(null);
    setNewWorkOrderForm({});
  };

  const handleCreateWorkOrder = async (incidentId: number) => {
    if (!newWorkOrderForm.assignedToId) {
      alert("Por favor selecciona un FSR");
      return;
    }

    setSavingNewWorkOrder(true);
    try {
      // Find ABIERTO status
      const abiertoStatus = incidentStatuses.find(
        (status) => status.name === "ABIERTO",
      );

      await createWorkOrder({
        incidentId,
        assignedToId: newWorkOrderForm.assignedToId,
        notes: newWorkOrderForm.notes || null,
        statusId: abiertoStatus?.id || null,
        folio: newWorkOrderForm.folio || null,
        startedAt: null,
        finishedAt: null,
      });
      setCreatingWorkOrder(null);
      setNewWorkOrderForm({});
      // Reload the incidents data to reflect the change
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error("Error creating work order:", error);
      alert("Error al crear la orden de trabajo");
    } finally {
      setSavingNewWorkOrder(false);
    }
  };

  const handleSaveIncident = async (incidentId: number) => {
    setSavingIncident(true);
    try {
      await updateIncidentDetails(incidentId, {
        title: editForm.title,
        description: editForm.description,
        reportedAt: editForm.reportedAt,
        resolvedAt: editForm.resolvedAt || null,
        statusId: parseInt(editForm.statusId, 10),
        lineId: editForm.lineId ? parseInt(editForm.lineId, 10) : null,
        equipmentId: editForm.equipmentId
          ? parseInt(editForm.equipmentId, 10)
          : null,
      });
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-MX");
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAssignedFSRs = (incident: TrackingIncident) => {
    if (incident.workOrders && incident.workOrders.length > 0) {
      // Get unique FSRs from all work orders
      type AssignedTo = { id: string; name: string } | null | undefined;
      const fsrs = incident.workOrders.map(
        (wo: TrackingWorkOrder) => wo.assignedTo,
      );
      const uniqueFsrs = fsrs.filter(
        (fsr: AssignedTo, index: number, self: AssignedTo[]) =>
          fsr && index === self.findIndex((f) => f?.id === fsr.id),
      );
      return uniqueFsrs;
    }
    return [];
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
            <TableHead>Línea</TableHead>
            <TableHead>FSR Asignado</TableHead>
            <TableHead>Folio ODT</TableHead>
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
                colSpan={13}
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
                          {assignedFSRs.map(
                            (fsr: {
                              id: string;
                              name: string;
                              email?: string;
                            }) => (
                              <div
                                key={fsr.id}
                                className="flex items-center gap-2"
                              >
                                <User className="h-3 w-3" />
                                <span className="text-sm">{fsr.name}</span>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sin asignar
                        </span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpansion(incident.id)}>
                      {incident.workOrders && incident.workOrders.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {incident.workOrders.map((wo: TrackingWorkOrder) =>
                            wo.folio ? (
                              <Badge
                                key={wo.id}
                                variant="outline"
                                className="text-xs"
                              >
                                {wo.folio}
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
                      <TableCell colSpan={12} className="bg-muted/30">
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
                                      value={editForm.statusId.toString()}
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
                                      value={editForm.resolvedAt}
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
                                    value={editForm.description}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        description: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              {/* Create Work Order in Edit Mode */}
                              <div className="p-4 bg-muted/50 rounded-lg border border-dashed space-y-4">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-semibold">
                                    Crear Orden de Trabajo
                                  </h5>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleStartCreateWorkOrder(incident.id)
                                    }
                                    disabled={creatingWorkOrder === incident.id}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nueva Orden
                                  </Button>
                                </div>

                                {creatingWorkOrder === incident.id && (
                                  <div className="p-4 bg-background rounded-lg border space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label
                                          htmlFor={`edit-mode-fsr-${incident.id}`}
                                        >
                                          FSR Asignado *
                                        </Label>
                                        <Select
                                          value={newWorkOrderForm.assignedToId}
                                          onValueChange={(value) =>
                                            setNewWorkOrderForm({
                                              ...newWorkOrderForm,
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
                                      <div className="space-y-2">
                                        <Label
                                          htmlFor={`edit-mode-folio-${incident.id}`}
                                        >
                                          Folio ODT
                                        </Label>
                                        <Input
                                          id={`edit-mode-folio-${incident.id}`}
                                          value={newWorkOrderForm.folio}
                                          onChange={(e) =>
                                            setNewWorkOrderForm({
                                              ...newWorkOrderForm,
                                              folio: e.target.value,
                                            })
                                          }
                                          placeholder="Folio opcional..."
                                        />
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
                                        value={newWorkOrderForm.notes}
                                        onChange={(e) =>
                                          setNewWorkOrderForm({
                                            ...newWorkOrderForm,
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
                                        onClick={handleCancelCreateWorkOrder}
                                        disabled={savingNewWorkOrder}
                                      >
                                        <XIcon className="h-4 w-4 mr-2" />
                                        Cancelar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleCreateWorkOrder(incident.id)
                                        }
                                        disabled={savingNewWorkOrder}
                                      >
                                        <Save className="h-4 w-4 mr-2" />
                                        {savingNewWorkOrder
                                          ? "Guardando..."
                                          : "Crear Orden"}
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

                          {/* Work Orders Section */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">
                                Órdenes de Trabajo
                              </h4>
                              {creatingWorkOrder !== incident.id && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleStartCreateWorkOrder(incident.id)
                                  }
                                  disabled={editingIncident === incident.id}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Crear Orden
                                </Button>
                              )}
                            </div>

                            {/* Create Work Order Form */}
                            {creatingWorkOrder === incident.id && (
                              <div className="p-4 bg-background rounded-lg border space-y-4 mb-3">
                                <h5 className="font-medium">
                                  Nueva Orden de Trabajo
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor={`new-fsr-${incident.id}`}>
                                      FSR Asignado *
                                    </Label>
                                    <Select
                                      value={newWorkOrderForm.assignedToId}
                                      onValueChange={(value) =>
                                        setNewWorkOrderForm({
                                          ...newWorkOrderForm,
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
                                  <div className="space-y-2">
                                    <Label htmlFor={`new-folio-${incident.id}`}>
                                      Folio ODT
                                    </Label>
                                    <Input
                                      id={`new-folio-${incident.id}`}
                                      value={newWorkOrderForm.folio}
                                      onChange={(e) =>
                                        setNewWorkOrderForm({
                                          ...newWorkOrderForm,
                                          folio: e.target.value,
                                        })
                                      }
                                      placeholder="Folio opcional..."
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`new-notes-${incident.id}`}>
                                    Notas
                                  </Label>
                                  <Textarea
                                    id={`new-notes-${incident.id}`}
                                    value={newWorkOrderForm.notes}
                                    onChange={(e) =>
                                      setNewWorkOrderForm({
                                        ...newWorkOrderForm,
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
                                    onClick={handleCancelCreateWorkOrder}
                                    disabled={savingNewWorkOrder}
                                  >
                                    <XIcon className="h-4 w-4 mr-2" />
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleCreateWorkOrder(incident.id)
                                    }
                                    disabled={savingNewWorkOrder}
                                  >
                                    <Save className="h-4 w-4 mr-2" />
                                    {savingNewWorkOrder
                                      ? "Guardando..."
                                      : "Crear Orden"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Existing Work Orders */}
                            {incident.workOrders &&
                              incident.workOrders.length > 0 && (
                                <div className="space-y-3">
                                  {incident.workOrders.map(
                                    (workOrder: TrackingWorkOrder) => (
                                      <div
                                        key={workOrder.id}
                                        className="p-4 bg-background rounded-lg border space-y-3"
                                      >
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="flex-1 space-y-2">
                                            {editingWorkOrder !==
                                              workOrder.id && (
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Badge
                                                  className={
                                                    workOrderStatusColors[
                                                      workOrder.status?.name
                                                    ] ||
                                                    "bg-gray-100 text-gray-800"
                                                  }
                                                >
                                                  {workOrder.status?.name
                                                    ? workOrderStatusLabels[
                                                        workOrder.status.name
                                                      ] || workOrder.status.name
                                                    : "Sin estado"}
                                                </Badge>
                                                <span className="text-sm text-muted-foreground">
                                                  Creado:{" "}
                                                  {formatDate(
                                                    workOrder.createdAt,
                                                  )}{" "}
                                                  -{" "}
                                                  {formatTime(
                                                    workOrder.createdAt,
                                                  )}
                                                </span>
                                              </div>
                                            )}

                                            {editingWorkOrder !==
                                              workOrder.id && (
                                              <>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-medium min-w-[100px]">
                                                    Fecha Inicio:
                                                  </span>
                                                  <span className="text-sm text-muted-foreground">
                                                    {workOrder.startedAt
                                                      ? `${formatDate(workOrder.startedAt)} - ${formatTime(workOrder.startedAt)}`
                                                      : "-"}
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-medium min-w-[100px]">
                                                    Fecha Fin:
                                                  </span>
                                                  <span className="text-sm text-muted-foreground">
                                                    {workOrder.finishedAt
                                                      ? `${formatDate(workOrder.finishedAt)} - ${formatTime(workOrder.finishedAt)}`
                                                      : "-"}
                                                  </span>
                                                </div>
                                              </>
                                            )}

                                            {workOrder.folio && (
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium min-w-[100px]">
                                                  Folio ODT:
                                                </span>
                                                <Badge
                                                  variant="outline"
                                                  className="text-sm"
                                                >
                                                  {workOrder.folio}
                                                </Badge>
                                              </div>
                                            )}

                                            {editingWorkOrder !==
                                              workOrder.id && (
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium min-w-[100px]">
                                                  FSR Asignado:
                                                </span>
                                                <span className="text-sm">
                                                  <User className="h-4 w-4 inline mr-2" />
                                                  {workOrder.assignedTo.name}
                                                </span>
                                              </div>
                                            )}

                                            {editingWorkOrder ===
                                              workOrder.id && (
                                              <div className="space-y-3 pt-3 border-t">
                                                <h5 className="font-semibold text-sm">
                                                  Editar Orden de Trabajo
                                                </h5>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                  <div className="space-y-2">
                                                    <Label
                                                      htmlFor={`wo-fsr-${workOrder.id}`}
                                                    >
                                                      FSR Asignado
                                                    </Label>
                                                    <Select
                                                      value={
                                                        workOrderEditForm.assignedToId
                                                      }
                                                      onValueChange={(value) =>
                                                        setWorkOrderEditForm({
                                                          ...workOrderEditForm,
                                                          assignedToId: value,
                                                        })
                                                      }
                                                    >
                                                      <SelectTrigger
                                                        id={`wo-fsr-${workOrder.id}`}
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
                                                      htmlFor={`wo-status-${workOrder.id}`}
                                                    >
                                                      Estado
                                                    </Label>
                                                    <Select
                                                      value={
                                                        workOrderEditForm.statusId?.toString() ||
                                                        ""
                                                      }
                                                      onValueChange={(value) =>
                                                        setWorkOrderEditForm({
                                                          ...workOrderEditForm,
                                                          statusId: value,
                                                        })
                                                      }
                                                    >
                                                      <SelectTrigger
                                                        id={`wo-status-${workOrder.id}`}
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
                                                      htmlFor={`wo-folio-${workOrder.id}`}
                                                    >
                                                      Folio ODT
                                                    </Label>
                                                    <Input
                                                      id={`wo-folio-${workOrder.id}`}
                                                      type="text"
                                                      placeholder="Número de folio..."
                                                      value={
                                                        workOrderEditForm.folio
                                                      }
                                                      onChange={(e) =>
                                                        setWorkOrderEditForm({
                                                          ...workOrderEditForm,
                                                          folio: e.target.value,
                                                        })
                                                      }
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      htmlFor={`wo-started-${workOrder.id}`}
                                                    >
                                                      Fecha y Hora de Inicio
                                                    </Label>
                                                    <Input
                                                      id={`wo-started-${workOrder.id}`}
                                                      type="datetime-local"
                                                      value={
                                                        workOrderEditForm.startedAt
                                                      }
                                                      onChange={(e) =>
                                                        setWorkOrderEditForm({
                                                          ...workOrderEditForm,
                                                          startedAt:
                                                            e.target.value,
                                                        })
                                                      }
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      htmlFor={`wo-finished-${workOrder.id}`}
                                                    >
                                                      Fecha y Hora de Fin
                                                    </Label>
                                                    <Input
                                                      id={`wo-finished-${workOrder.id}`}
                                                      type="datetime-local"
                                                      value={
                                                        workOrderEditForm.finishedAt
                                                      }
                                                      onChange={(e) =>
                                                        setWorkOrderEditForm({
                                                          ...workOrderEditForm,
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
                                            {editingWorkOrder ===
                                            workOrder.id ? (
                                              <>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    handleCancelWorkOrderEdit(
                                                      workOrder.id,
                                                    )
                                                  }
                                                  disabled={
                                                    savingWorkOrder ===
                                                    workOrder.id
                                                  }
                                                >
                                                  <XIcon className="h-4 w-4 mr-2" />
                                                  Cancelar
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  onClick={() =>
                                                    handleSaveWorkOrder(
                                                      workOrder.id,
                                                    )
                                                  }
                                                  disabled={
                                                    savingWorkOrder ===
                                                    workOrder.id
                                                  }
                                                >
                                                  <Save className="h-4 w-4 mr-2" />
                                                  {savingWorkOrder ===
                                                  workOrder.id
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
                                                    handleEditWorkOrder(
                                                      workOrder,
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
                                                        href={`/admin/work-orders/${workOrder.id}`}
                                                      >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        Ver Orden
                                                      </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                      <Link
                                                        href={`/admin/work-orders/${workOrder.id}/edit`}
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

                                        {workOrder.notes && (
                                          <div className="text-sm pt-2 border-t">
                                            <span className="font-medium">
                                              Notas:
                                            </span>{" "}
                                            {workOrder.notes}
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
