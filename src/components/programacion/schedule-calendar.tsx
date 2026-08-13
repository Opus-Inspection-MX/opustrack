"use client";

import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { QuickEditScheduleDialog } from "@/components/admin/schedules/quick-edit-schedule-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMX, mxDateString, mxHour } from "@/lib/utils/datetime";

interface ScheduledIncident {
  id: number;
  title: string;
  reportedAt: string;
  schedule: {
    id?: string;
    scheduledAt: string;
  } | null;
  priority: number;
  status: {
    name: string;
    color: string;
  } | null;
}

interface ScheduleItem {
  id: string;
  title: string;
  scheduledAt: string;
  endDate: string | null;
  clientes: Array<{
    clienteId: string;
    active: boolean;
    cliente: { id: string; code: string; name: string };
  }>;
  _count: { incidents: number };
}

interface ClienteOption {
  id: string;
  code: string;
  name: string;
}

interface ScheduleCalendarProps {
  dateRange: {
    start: Date;
    end: Date;
    type: "day" | "week" | "month" | "custom";
  };
  onDateRangeChange: (range: {
    start: Date;
    end: Date;
    type: "day" | "week" | "month" | "custom";
  }) => void;
  /** All Clientes accessible by the user — needed for the quick-edit dialog. */
  clientes?: ClienteOption[];
}

export function ScheduleCalendar({
  dateRange,
  onDateRangeChange,
  clientes = [],
}: ScheduleCalendarProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "custom">(
    dateRange.type,
  );
  const [incidents, setIncidents] = useState<ScheduledIncident[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [quickEditId, setQuickEditId] = useState<string | null>(null);

  // Reload schedules + incidents (used by the dialog after saving).
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Fetch incidents from backend
  const fetchIncidents = useCallback(async (start: Date, end: Date) => {
    try {
      const startStr = mxDateString(start);
      const endStr = mxDateString(end);

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
    }
  }, []);

  const fetchSchedules = useCallback(async (start: Date, end: Date) => {
    try {
      const startStr = mxDateString(start);
      const endStr = mxDateString(end);
      const response = await fetch(
        `/api/schedules?startDate=${startStr}&endDate=${endStr}`,
      );
      if (!response.ok) throw new Error("Error al obtener programaciones");
      const result = await response.json();
      setSchedules(result.data || []);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      setSchedules([]);
    }
  }, []);

  const getWeekRange = useCallback((date: Date) => {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Ajustar para que la semana comience en lunes (1)
    // Si es domingo (0), retroceder 6 días; si es lunes (1), retroceder 0 días, etc.
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(date);
    start.setDate(date.getDate() + diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, []);

  // Load incidents and schedules when date range changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is a reload trigger
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let start = new Date(currentDate);
      let end = new Date(currentDate);

      if (viewMode === "week") {
        const range = getWeekRange(new Date(currentDate));
        start = range.start;
        end = range.end;
      } else if (viewMode === "month") {
        start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        end = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0,
        );
        end.setHours(23, 59, 59, 999);
      } else {
        // day view
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      }

      await Promise.all([
        fetchIncidents(start, end),
        fetchSchedules(start, end),
      ]);
      setLoading(false);
    };

    fetchData();
  }, [
    currentDate,
    viewMode,
    fetchIncidents,
    fetchSchedules,
    getWeekRange,
    reloadKey,
  ]);

  // Helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    // Ajustar para que lunes sea 0: Domingo = 6, Lunes = 0, Martes = 1, etc.
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  // Get incidents for a specific date (scheduled by scheduledAt, otherwise reportedAt)
  const getIncidentsForDate = (date: Date) => {
    const dateStr = mxDateString(date);
    return incidents.filter((incident) => {
      const dateField = incident.schedule?.scheduledAt || incident.reportedAt;
      if (!dateField) return false;
      const incidentDate = mxDateString(new Date(dateField));
      return incidentDate === dateStr;
    });
  };

  const getSchedulesForDate = (date: Date) => {
    const dateStr = mxDateString(date);
    return schedules.filter((schedule) => {
      const scheduleDate = mxDateString(new Date(schedule.scheduledAt));
      if (schedule.endDate) {
        const endDate = mxDateString(new Date(schedule.endDate));
        return dateStr >= scheduleDate && dateStr <= endDate;
      }
      return scheduleDate === dateStr;
    });
  };

  const getIncidentCountForDate = (date: Date) => {
    return getIncidentsForDate(date).length;
  };

  const getScheduleCountForDate = (date: Date) => {
    return getSchedulesForDate(date).length;
  };

  const getMonthName = (date: Date) => {
    return formatMX(date, { month: "long", year: "numeric" });
  };

  const getWeekDays = () => {
    return ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1));
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === "next" ? 1 : -1));
    setCurrentDate(newDate);
  };

  const handleNavigate = (direction: "prev" | "next") => {
    if (viewMode === "month") navigateMonth(direction);
    else if (viewMode === "week") navigateWeek(direction);
    else navigateDay(direction);
  };

  const handleViewModeChange = (mode: string) => {
    const newMode = mode as "day" | "week" | "month" | "custom";
    setViewMode(newMode);

    let start = new Date(currentDate);
    let end = new Date(currentDate);

    if (newMode === "week") {
      const range = getWeekRange(new Date(currentDate));
      start = range.start;
      end = range.end;
    } else if (newMode === "month") {
      start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    } else if (newMode === "custom") {
      start = customStartDate;
      end = customEndDate;
    }

    onDateRangeChange({ start, end, type: newMode });
  };

  const handleCustomDateChange = () => {
    onDateRangeChange({
      start: customStartDate,
      end: customEndDate,
      type: "custom",
    });
  };

  const handleDateClick = (date: Date) => {
    let start = new Date(date);
    let end = new Date(date);
    let type: "day" | "week" | "month" = "day";

    if (viewMode === "week") {
      const range = getWeekRange(new Date(date));
      start = range.start;
      end = range.end;
      type = "week";
    } else if (viewMode === "month") {
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      type = "month";
    }

    setCurrentDate(date);
    onDateRangeChange({ start, end, type });
  };

  // Render month view
  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2" />);
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day,
      );
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = date.toDateString() === currentDate.toDateString();

      days.push(
        <button
          type="button"
          key={day}
          onClick={() => handleDateClick(date)}
          className={`p-2 text-sm rounded-lg hover:bg-accent transition-colors ${
            isToday ? "bg-purple-500/10 text-purple-600 font-semibold" : ""
          } ${isSelected ? "ring-2 ring-purple-500" : ""}`}
        >
          <div className="flex flex-col items-center">
            <span>{day}</span>
            <div className="flex gap-1 mt-1">
              {getScheduleCountForDate(date) > 0 && (
                <div className="text-[10px] bg-orange-500 text-white rounded-full px-1.5 py-0.5">
                  {getScheduleCountForDate(date)}
                </div>
              )}
              {getIncidentCountForDate(date) > 0 && (
                <div className="text-[10px] bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                  {getIncidentCountForDate(date)}
                </div>
              )}
            </div>
          </div>
        </button>,
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {getWeekDays().map((day) => (
          <div
            key={day}
            className="p-2 text-xs font-medium text-center text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const weekRange = getWeekRange(new Date(currentDate));
    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekRange.start);
      date.setDate(weekRange.start.getDate() + i);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = date.toDateString() === currentDate.toDateString();
      const dayIncidents = getIncidentsForDate(date);
      const daySchedules = getSchedulesForDate(date);

      days.push(
        <button
          type="button"
          key={i}
          onClick={() => handleDateClick(date)}
          className={`p-4 rounded-lg border hover:bg-accent transition-colors ${
            isToday ? "bg-purple-500/10 border-purple-500" : ""
          } ${isSelected ? "ring-2 ring-purple-500" : ""}`}
        >
          <div className="text-xs text-muted-foreground">
            {getWeekDays()[i]}
          </div>
          <div className="text-2xl font-bold mt-1">{date.getDate()}</div>
          <div className="mt-2 space-y-1">
            {daySchedules.length > 0 && (
              <div className="text-xs bg-orange-500/10 text-orange-600 px-2 py-1 rounded">
                {daySchedules.length} Programación
                {daySchedules.length !== 1 ? "es" : ""}
              </div>
            )}
            {dayIncidents.length > 0 && (
              <div className="text-xs bg-blue-500/10 text-blue-600 px-2 py-1 rounded">
                {dayIncidents.length} Incidente
                {dayIncidents.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </button>,
      );
    }

    return <div className="grid grid-cols-7 gap-2">{days}</div>;
  };

  // Render day view
  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const isToday = currentDate.toDateString() === new Date().toDateString();
    const dayIncidents = getIncidentsForDate(currentDate);
    const daySchedules = getSchedulesForDate(currentDate);

    // Group incidents by hour (use scheduledAt if scheduled, else reportedAt)
    const incidentsByHour: { [key: number]: ScheduledIncident[] } = {};
    dayIncidents.forEach((incident) => {
      const dateField = incident.schedule?.scheduledAt || incident.reportedAt;
      if (!dateField) return;
      const hour = mxHour(new Date(dateField));
      if (!incidentsByHour[hour]) incidentsByHour[hour] = [];
      incidentsByHour[hour].push(incident);
    });

    // Group schedules by hour
    const schedulesByHour: { [key: number]: ScheduleItem[] } = {};
    daySchedules.forEach((schedule) => {
      const hour = mxHour(new Date(schedule.scheduledAt));
      if (!schedulesByHour[hour]) schedulesByHour[hour] = [];
      schedulesByHour[hour].push(schedule);
    });

    return (
      <div className="space-y-4">
        <div
          className={`p-4 rounded-lg border ${isToday ? "bg-purple-500/10 border-purple-500" : ""}`}
        >
          <div className="text-sm text-muted-foreground">
            {formatMX(currentDate, { weekday: "long" })}
          </div>
          <div className="text-3xl font-bold mt-1">
            {formatMX(currentDate, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {hours.map((hour) => (
            <div key={hour} className="flex gap-4 items-start">
              <div className="w-16 text-sm text-muted-foreground pt-2">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="flex-1 border-l-2 pl-4 py-2 min-h-[60px]">
                {schedulesByHour[hour]?.map((schedule) => {
                  const activeClientes = schedule.clientes.filter(
                    (sv) => sv.active,
                  );
                  return (
                    <div
                      key={schedule.id}
                      className="bg-orange-500/10 border-l-4 border-orange-500 p-2 rounded mb-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm">
                          {schedule.title}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickEditId(schedule.id);
                          }}
                          title="Edición rápida"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {activeClientes.length === 0
                          ? "Sin Clientes"
                          : activeClientes
                              .map((sv) => sv.cliente.code)
                              .join(", ")}{" "}
                        • {schedule._count.incidents} incidente(s)
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Inicio:</span>{" "}
                        {formatMX(schedule.scheduledAt, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                      {schedule.endDate && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Fin:</span>{" "}
                          {formatMX(schedule.endDate, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {incidentsByHour[hour]?.map((incident) => (
                  <button
                    type="button"
                    key={incident.id}
                    onClick={() =>
                      router.push(`/admin/incidents/${incident.id}/edit`)
                    }
                    className="bg-blue-500/10 border-l-4 border-blue-500 p-2 rounded mb-2 w-full text-left hover:bg-blue-500/20 transition-colors cursor-pointer"
                  >
                    <div className="font-medium text-sm">{incident.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Prioridad: {incident.priority}
                      {incident.status && ` • ${incident.status.name}`}
                      {!incident.schedule && " • Sin programación"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="capitalize">
              {getMonthName(currentDate)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigate("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDateClick(new Date())}
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigate("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Tabs
            value={viewMode}
            onValueChange={handleViewModeChange}
            className="mt-4"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="month">Mes</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="day">Día</TabsTrigger>
              <TabsTrigger value="custom">Rango</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {viewMode === "month" && renderMonthView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "day" && renderDayView()}
          {viewMode === "custom" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha Inicio</Label>
                  <Input
                    type="date"
                    value={mxDateString(customStartDate)}
                    onChange={(e) =>
                      setCustomStartDate(new Date(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Fin</Label>
                  <Input
                    type="date"
                    value={mxDateString(customEndDate)}
                    onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                  />
                </div>
              </div>
              <Button onClick={handleCustomDateChange} className="w-full">
                Aplicar Rango de Fechas
              </Button>
              <div className="text-sm text-muted-foreground text-center">
                Mostrando incidentes del{" "}
                {formatMX(customStartDate, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                al{" "}
                {formatMX(customEndDate, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando incidentes...
                </div>
              ) : incidents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay incidentes programados en este rango
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {incidents.map((incident) => (
                    <button
                      type="button"
                      key={incident.id}
                      onClick={() =>
                        router.push(`/admin/incidents/${incident.id}/edit`)
                      }
                      className="p-3 border rounded-lg hover:bg-accent transition-colors w-full text-left cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{incident.title}</h4>
                          <div className="text-sm text-muted-foreground mt-1">
                            {incident.schedule?.scheduledAt &&
                              formatMX(incident.schedule.scheduledAt, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                          </div>
                        </div>
                        <Badge
                          variant={
                            incident.priority >= 8 ? "destructive" : "default"
                          }
                        >
                          Prioridad: {incident.priority}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 pt-4 border-t space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Leyenda
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs">Programaciones</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs">Incidentes</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <QuickEditScheduleDialog
        scheduleId={quickEditId}
        clientes={clientes}
        open={quickEditId !== null}
        onOpenChange={(open) => {
          if (!open) setQuickEditId(null);
        }}
        onSaved={() => {
          setQuickEditId(null);
          triggerReload();
        }}
      />
    </>
  );
}
