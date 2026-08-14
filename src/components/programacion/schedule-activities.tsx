"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BulkAssignDialog } from "@/components/admin/incidents/bulk-assign-dialog";
import { QuickEditDatePopover } from "@/components/admin/incidents/quick-edit-date-popover";
import { QuickEditFsrsPopover } from "@/components/admin/incidents/quick-edit-fsrs-popover";
import { QuickEditTypePopover } from "@/components/admin/incidents/quick-edit-type-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { getFsrsForAssignment } from "@/lib/actions/incidents";
import { formatMX, mxDateString } from "@/lib/utils/datetime";

interface Incident {
  id: number;
  title: string;
  description?: string | null;
  schedule: {
    id: string;
    title: string;
    scheduledAt: string;
    endDate: string | null;
  } | null;
  status: { id: number; name: string; color: string } | null;
  type: { id: number; name: string } | null;
  cliente: { id: string; name: string; code?: string } | null;
  assignees: Array<{ user: { id: string; name: string; email: string } }>;
  _count: { assignees: number };
  assignments: Array<{ id: string; status?: { name: string } | null }>;
}

interface IncidentType {
  id: number;
  name: string;
}

interface ScheduleOption {
  id: string;
  title: string;
}

interface Cliente {
  id: string;
  name: string;
  code: string;
}

interface FsrOption {
  id: string;
  name: string;
  email: string;
  clienteIds: string[];
}

interface ScheduleActivitiesProps {
  dateRange: {
    start: Date;
    end: Date;
    type: "day" | "week" | "month" | "custom";
  };
  selectedSchedule?: {
    id: string;
    title: string;
  } | null;
}

export function ScheduleActivities({
  dateRange,
  selectedSchedule,
}: ScheduleActivitiesProps) {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fsrs, setFsrs] = useState<FsrOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedClientes, setSelectedClientes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedScheduleFilters, setSelectedScheduleFilters] = useState<
    string[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    if (selectedSchedule) {
      setSelectedScheduleFilters([selectedSchedule.id]);
    } else {
      setSelectedScheduleFilters([]);
    }
  }, [selectedSchedule]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = mxDateString(dateRange.start);
      const endStr = mxDateString(dateRange.end);

      const response = await fetch(
        `/api/schedules/incidents?start=${startStr}&end=${endStr}`,
      );

      if (!response.ok) {
        throw new Error("Error al obtener incidentes");
      }

      const result = await response.json();
      setIncidents(result.data || []);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchIncidentTypes = useCallback(async () => {
    try {
      const response = await fetch("/api/incident-types");
      if (!response.ok) return;
      const result = await response.json();
      setIncidentTypes(result.data || []);
    } catch (error) {
      console.error("Error fetching incident types:", error);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const response = await fetch("/api/schedules");
      if (!response.ok) return;
      const result = await response.json();
      setSchedules(result.data || []);
    } catch (error) {
      console.error("Error fetching schedules:", error);
    }
  }, []);

  const fetchClientes = useCallback(async () => {
    try {
      const response = await fetch("/api/clientes");
      if (!response.ok) return;
      const result = await response.json();
      setClientes(result.data || []);
    } catch (error) {
      console.error("Error fetching Clientes:", error);
    }
  }, []);

  const fetchFsrs = useCallback(async () => {
    try {
      const result = await getFsrsForAssignment();
      setFsrs(result);
    } catch (error) {
      console.error("Error fetching FSRs:", error);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Esta pantalla se deja abierta mientras otros asignan y cierran trabajo.
  // Se consulta la firma, no la tabla; ver `useLiveRefresh`.
  useLiveRefresh({
    signature: useCallback(async () => {
      const startStr = mxDateString(dateRange.start);
      const endStr = mxDateString(dateRange.end);
      const response = await fetch(
        `/api/schedules/incidents?start=${startStr}&end=${endStr}&signature=1`,
      );
      if (!response.ok) return null;
      const result = await response.json();
      return (result.signature as string) ?? null;
    }, [dateRange]),
    onChanged: fetchIncidents,
  });

  useEffect(() => {
    fetchIncidentTypes();
    fetchSchedules();
    fetchClientes();
    fetchFsrs();
  }, [fetchIncidentTypes, fetchSchedules, fetchClientes, fetchFsrs]);

  // Filtrar + ordenar: incidentes sin FSRs habilitados arriba.
  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = incidents.filter((incident) => {
      if (
        selectedClientes.length > 0 &&
        (!incident.cliente?.id ||
          !selectedClientes.includes(incident.cliente.id))
      ) {
        return false;
      }
      if (
        selectedTypes.length > 0 &&
        (!incident.type?.id ||
          !selectedTypes.includes(incident.type.id.toString()))
      ) {
        return false;
      }
      if (
        selectedScheduleFilters.length > 0 &&
        (!incident.schedule?.id ||
          !selectedScheduleFilters.includes(incident.schedule.id))
      ) {
        return false;
      }
      if (q) {
        const haystack = [
          incident.title,
          incident.description ?? "",
          incident.cliente?.code ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const aHas = (a._count?.assignees ?? 0) > 0 ? 1 : 0;
      const bHas = (b._count?.assignees ?? 0) > 0 ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas; // 0 first (no FSRs)
      // then by scheduled start date ascending
      const aDate = a.schedule?.scheduledAt
        ? new Date(a.schedule.scheduledAt).getTime()
        : Number.POSITIVE_INFINITY;
      const bDate = b.schedule?.scheduledAt
        ? new Date(b.schedule.scheduledAt).getTime()
        : Number.POSITIVE_INFINITY;
      return aDate - bDate;
    });
  }, [
    incidents,
    selectedClientes,
    selectedTypes,
    selectedScheduleFilters,
    searchQuery,
  ]);

  const allVisibleSelected =
    filteredIncidents.length > 0 &&
    filteredIncidents.every((i) => selectedIds.has(i.id));
  const someVisibleSelected =
    filteredIncidents.some((i) => selectedIds.has(i.id)) && !allVisibleSelected;

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const i of filteredIncidents) next.delete(i.id);
      } else {
        for (const i of filteredIncidents) next.add(i.id);
      }
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clienteOptions = clientes.map((v) => ({
    value: v.id,
    label: `${v.code} — ${v.name}`,
  }));
  const scheduleOptionsForBulk = schedules.map((s) => ({
    value: s.id,
    label: s.title,
  }));
  const fsrOptionsForBulk = fsrs.map((f) => ({
    value: f.id,
    label: f.name,
    sublabel: f.email,
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Actividades Programadas</CardTitle>
          {selectedSchedule && (
            <Badge variant="secondary" className="ml-2">
              Programación: {selectedSchedule.title}
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatMX(dateRange.start, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          -{" "}
          {formatMX(dateRange.end, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tipo de Incidente</Label>
            <MultiSelect
              options={incidentTypes.map((type) => ({
                value: type.id.toString(),
                label: type.name,
              }))}
              value={selectedTypes}
              onValueChange={setSelectedTypes}
              placeholder="Todos los tipos"
              searchPlaceholder="Buscar tipo..."
              emptyMessage="No se encontraron tipos."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Programación</Label>
            <MultiSelect
              options={schedules.map((schedule) => ({
                value: schedule.id,
                label: schedule.title,
              }))}
              value={selectedScheduleFilters}
              onValueChange={setSelectedScheduleFilters}
              placeholder="Todas las programaciones"
              searchPlaceholder="Buscar programación..."
              emptyMessage="No se encontraron programaciones."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Cliente</Label>
            <MultiSelect
              options={clienteOptions}
              value={selectedClientes}
              onValueChange={setSelectedClientes}
              placeholder="Todos los Clientes"
              searchPlaceholder="Buscar Cliente..."
              emptyMessage="No se encontraron Clientes."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar incidente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {filteredIncidents.length} de {incidents.length}{" "}
            incidentes
          </div>
        </div>

        {/* Bulk selection bar */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span>
              <strong>{selectedIds.size}</strong> seleccionado
              {selectedIds.size === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setBulkOpen(true)}>
                Asignar en masa
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="mr-1 h-3 w-3" />
                Limpiar selección
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando incidentes...
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        allVisibleSelected
                          ? true
                          : someVisibleSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={toggleAll}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Programación</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>FSRs</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncidents.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-8"
                    >
                      {loading
                        ? "Cargando incidentes..."
                        : "No hay incidentes que coincidan con los filtros"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIncidents.map((incident) => {
                    const isSelected = selectedIds.has(incident.id);
                    const fsrCount = incident._count?.assignees ?? 0;
                    return (
                      <TableRow
                        key={incident.id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          isSelected ? "bg-muted/30" : ""
                        }`}
                        onClick={(e) => {
                          if (
                            (e.target as HTMLElement).closest(
                              "[data-no-row-nav]",
                            )
                          ) {
                            return;
                          }
                          router.push(`/admin/incidents/${incident.id}/edit`);
                        }}
                      >
                        <TableCell data-no-row-nav>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(incident.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Seleccionar incidente ${incident.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {incident.title}
                        </TableCell>
                        <TableCell data-no-row-nav>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline">
                              {incident.type?.name || "Sin tipo"}
                            </Badge>
                            <QuickEditTypePopover
                              incidentId={incident.id}
                              initialTypeId={incident.type?.id ?? null}
                              types={incidentTypes}
                              onSaved={fetchIncidents}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {incident.schedule?.title || "Sin programación"}
                          </div>
                        </TableCell>
                        <TableCell data-no-row-nav>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">
                              {incident.schedule?.scheduledAt
                                ? formatMX(incident.schedule.scheduledAt)
                                : "Sin fecha"}
                            </span>
                            <QuickEditDatePopover
                              incidentId={incident.id}
                              initialScheduledAt={
                                incident.schedule?.scheduledAt ?? null
                              }
                              onSaved={fetchIncidents}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {incident.cliente?.name || "Sin Cliente"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {fsrCount === 0 ? (
                            <Badge variant="destructive">Sin FSRs</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {incident.assignees.map((a) => (
                                <Badge key={a.user.id} variant="secondary">
                                  {a.user.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {incident.status?.name || "Sin estado"}
                          </Badge>
                        </TableCell>
                        <TableCell data-no-row-nav>
                          <QuickEditFsrsPopover
                            incidentId={incident.id}
                            initialFsrIds={incident.assignees.map(
                              (a) => a.user.id,
                            )}
                            allFsrs={fsrs}
                            onSaved={fetchIncidents}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <BulkAssignDialog
        incidentIds={[...selectedIds]}
        clientes={clienteOptions}
        schedules={scheduleOptionsForBulk}
        fsrs={fsrOptionsForBulk}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSaved={() => {
          setSelectedIds(new Set());
          fetchIncidents();
        }}
      />
    </Card>
  );
}
