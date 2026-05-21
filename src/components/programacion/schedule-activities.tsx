"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BulkAssignDialog } from "@/components/admin/incidents/bulk-assign-dialog";
import { QuickEditFsrsPopover } from "@/components/admin/incidents/quick-edit-fsrs-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
import { getFsrsForAssignment } from "@/lib/actions/incidents";

interface Incident {
  id: number;
  title: string;
  priority: number;
  schedule: {
    id: string;
    title: string;
    scheduledAt: string;
    endDate: string | null;
  } | null;
  status: { id: number; name: string; color: string } | null;
  type: { id: number; name: string } | null;
  vic: { id: string; name: string; code?: string } | null;
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

interface VIC {
  id: string;
  name: string;
  code: string;
}

interface FsrOption {
  id: string;
  name: string;
  email: string;
  vicIds: string[];
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
  const [vics, setVics] = useState<VIC[]>([]);
  const [fsrs, setFsrs] = useState<FsrOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedVic, setSelectedVic] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedScheduleFilter, setSelectedScheduleFilter] =
    useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    if (selectedSchedule) {
      setSelectedScheduleFilter(selectedSchedule.id);
    } else {
      setSelectedScheduleFilter("all");
    }
  }, [selectedSchedule]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = dateRange.start.toISOString().split("T")[0];
      const endStr = dateRange.end.toISOString().split("T")[0];

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

  const fetchVics = useCallback(async () => {
    try {
      const response = await fetch("/api/vics");
      if (!response.ok) return;
      const result = await response.json();
      setVics(result.data || []);
    } catch (error) {
      console.error("Error fetching VICs:", error);
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

  useEffect(() => {
    fetchIncidentTypes();
    fetchSchedules();
    fetchVics();
    fetchFsrs();
  }, [fetchIncidentTypes, fetchSchedules, fetchVics, fetchFsrs]);

  // Filtrar + ordenar: incidentes sin FSRs habilitados arriba.
  const filteredIncidents = useMemo(() => {
    const filtered = incidents.filter((incident) => {
      if (selectedVic !== "all" && incident.vic?.id !== selectedVic) {
        return false;
      }
      if (
        selectedType !== "all" &&
        incident.type?.id.toString() !== selectedType
      ) {
        return false;
      }
      if (
        selectedScheduleFilter !== "all" &&
        incident.schedule?.id !== selectedScheduleFilter
      ) {
        return false;
      }
      if (
        searchQuery &&
        !incident.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const aHas = (a._count?.assignees ?? 0) > 0 ? 1 : 0;
      const bHas = (b._count?.assignees ?? 0) > 0 ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas; // 0 first (no FSRs)
      if (a.priority !== b.priority) return b.priority - a.priority; // priority desc
      return 0;
    });
  }, [
    incidents,
    selectedVic,
    selectedType,
    selectedScheduleFilter,
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

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "destructive";
    if (priority >= 6) return "default";
    return "secondary";
  };

  const vicOptions = vics.map((v) => ({
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
          {dateRange.start.toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          -{" "}
          {dateRange.end.toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tipo de Incidente</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {incidentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Programación</Label>
            <SearchableSelect
              options={[
                { value: "all", label: "Todas las programaciones" },
                ...schedules.map((schedule) => ({
                  value: schedule.id,
                  label: schedule.title,
                })),
              ]}
              value={selectedScheduleFilter}
              onValueChange={setSelectedScheduleFilter}
              placeholder="Todas las programaciones"
              searchPlaceholder="Buscar programación..."
              emptyMessage="No se encontraron programaciones."
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">VIC</Label>
            <SearchableSelect
              options={[
                { value: "all", label: "Todos los VICs" },
                ...vicOptions,
              ]}
              value={selectedVic}
              onValueChange={setSelectedVic}
              placeholder="Todos los VICs"
              searchPlaceholder="Buscar VIC..."
              emptyMessage="No se encontraron VICs."
              className="h-9"
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
                  <TableHead>VIC</TableHead>
                  <TableHead>FSRs</TableHead>
                  <TableHead>Prioridad</TableHead>
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
                        <TableCell>
                          <Badge variant="outline">
                            {incident.type?.name || "Sin tipo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {incident.schedule?.title || "Sin programación"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {incident.vic?.name || "Sin VIC"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {fsrCount === 0 ? (
                            <Badge variant="destructive">Sin FSRs</Badge>
                          ) : (
                            <Badge variant="secondary">
                              {fsrCount} FSR{fsrCount === 1 ? "" : "s"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityColor(incident.priority)}>
                            {incident.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {incident.status?.name || "Sin estado"}
                          </Badge>
                        </TableCell>
                        <TableCell data-no-row-nav>
                          <QuickEditFsrsPopover
                            incidentId={incident.id}
                            incidentVicId={incident.vic?.id ?? null}
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
        vics={vicOptions}
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
