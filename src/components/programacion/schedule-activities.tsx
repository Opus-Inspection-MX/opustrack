"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  status: {
    id: number;
    name: string;
    color: string;
  } | null;
  type: {
    id: number;
    name: string;
  } | null;
  vic: {
    id: string;
    name: string;
  } | null;
  workOrders: Array<{ id: string; status?: { name: string } | null }>;
}

interface IncidentType {
  id: number;
  name: string;
}

interface Schedule {
  id: string;
  title: string;
}

interface VIC {
  id: string;
  name: string;
  code: string;
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
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vics, setVics] = useState<VIC[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedVic, setSelectedVic] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedScheduleFilter, setSelectedScheduleFilter] =
    useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sincronizar filtro de schedule con selección
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

  // Cargar incidentes cuando cambia el rango de fechas
  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Cargar tipos, schedules y vics al montar
  useEffect(() => {
    fetchIncidentTypes();
    fetchSchedules();
    fetchVics();
  }, [fetchIncidentTypes, fetchSchedules, fetchVics]);

  // Filtrar incidentes
  const filteredIncidents = incidents.filter((incident) => {
    // Filtro por VIC
    if (selectedVic !== "all" && incident.vic?.id !== selectedVic) {
      return false;
    }

    // Filtro por tipo
    if (
      selectedType !== "all" &&
      incident.type?.id.toString() !== selectedType
    ) {
      return false;
    }

    // Filtro por schedule
    if (
      selectedScheduleFilter !== "all" &&
      incident.schedule?.id !== selectedScheduleFilter
    ) {
      return false;
    }

    // Filtro por búsqueda
    if (
      searchQuery &&
      !incident.title.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "destructive";
    if (priority >= 6) return "default";
    return "secondary";
  };

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

        {/* Filters */}
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
                ...vics.map((vic) => ({
                  value: vic.id,
                  label: `${vic.name} (${vic.code})`,
                })),
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

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando incidentes...
          </div>
        ) : (
          <div>
            {/* Incidents Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Programación</TableHead>
                    <TableHead>VIC</TableHead>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        {loading
                          ? "Cargando incidentes..."
                          : "No hay incidentes que coincidan con los filtros"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIncidents.map((incident) => (
                      <TableRow
                        key={incident.id}
                        className="cursor-pointer hover:bg-muted/50"
                      >
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
                          <div className="text-sm">
                            {incident.schedule?.scheduledAt ? (
                              <>
                                <div className="font-medium text-xs text-muted-foreground mb-1">
                                  Inicio:
                                </div>
                                <div>
                                  {new Date(
                                    incident.schedule.scheduledAt,
                                  ).toLocaleDateString("es-MX")}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {new Date(
                                    incident.schedule.scheduledAt,
                                  ).toLocaleTimeString("es-MX", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                                {incident.schedule?.endDate && (
                                  <>
                                    <div className="font-medium text-xs text-muted-foreground mt-2 mb-1">
                                      Fin:
                                    </div>
                                    <div>
                                      {new Date(
                                        incident.schedule.endDate,
                                      ).toLocaleDateString("es-MX")}
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                      {new Date(
                                        incident.schedule.endDate,
                                      ).toLocaleTimeString("es-MX", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  </>
                                )}
                              </>
                            ) : (
                              "Sin fecha"
                            )}
                          </div>
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
