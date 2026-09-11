"use client";

import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { CreateIncidentDialog } from "@/components/programacion/create-incident-dialog";
import { CreateProgramDialog } from "@/components/programacion/create-program-dialog";
import { ScheduleActivities } from "@/components/programacion/schedule-activities";
import { ScheduleCalendar } from "@/components/programacion/schedule-calendar";
import { SelectScheduleDialog } from "@/components/programacion/select-schedule-dialog";
import { Button } from "@/components/ui/button";
import { currentWeekRange } from "@/lib/utils/datetime";

interface ClientOption {
  id: string;
  code: string;
  name: string;
}

export default function ProgramacionPage() {
  const [clients, setClientes] = useState<ClientOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => {
        if (cancelled) return;
        setClientes(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setClientes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [selectedDateRange, setSelectedDateRange] = useState<{
    start: Date;
    end: Date;
    type: "day" | "week" | "month" | "custom";
  }>(() => {
    const { start, end } = currentWeekRange();
    return { start, end, type: "week" };
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectScheduleDialogOpen, setSelectScheduleDialogOpen] =
    useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<{
    id: string;
    title: string;
    scheduledAt: string;
    endDate: string | null;
  } | null>(null);
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title="Asignación de Programación"
        description="Asigna incidentes a programaciones, calibraciones y mantenimientos"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectScheduleDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Calendar className="h-4 w-4 sm:mr-2" aria-hidden />
              <span className="hidden sm:inline">Seleccionar Programación</span>
            </Button>
            {selectedSchedule && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSchedule(null)}
                  className="w-full sm:w-auto"
                >
                  <span className="hidden sm:inline">Limpiar Selección</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setCreateDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 sm:mr-2" aria-hidden />
                  <span className="hidden sm:inline">
                    Nuevo Incidente en Programación
                  </span>
                  <span className="sm:hidden">Incidente</span>
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:flex"
              onClick={() => setCalendarCollapsed(!calendarCollapsed)}
            >
              {calendarCollapsed ? (
                <ChevronLeft className="h-4 w-4 sm:mr-2" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 sm:mr-2" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {calendarCollapsed ? "Mostrar" : "Ocultar"} Calendario
              </span>
            </Button>
            {!selectedSchedule && (
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 sm:mr-2" aria-hidden />
                <span className="hidden sm:inline">
                  {selectedDateRange.type === "day"
                    ? "Nuevo Incidente"
                    : "Nueva Programación"}
                </span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            )}
          </>
        }
      />

      {/* Responsive layout */}
      <div className="flex flex-col gap-4 lg:grid lg:gap-4 transition-all duration-500 ease-in-out">
        {/* Calendar - Always visible on mobile (top), collapsible on desktop (right side) */}
        <div
          className={`overflow-auto transition-all duration-500 ease-in-out order-1 lg:order-2 ${
            calendarCollapsed
              ? "hidden lg:hidden"
              : "block max-h-[50vh] lg:max-h-none"
          }`}
          style={{
            gridColumn: calendarCollapsed ? undefined : "span 1",
          }}
        >
          <ScheduleCalendar
            dateRange={selectedDateRange}
            onDateRangeChange={setSelectedDateRange}
            clients={clients}
          />
        </div>

        {/* Activities - Below calendar on mobile, left side on desktop */}
        <div
          className={`order-2 lg:order-1 transition-all duration-500 ease-in-out ${
            calendarCollapsed ? "lg:col-span-2" : ""
          }`}
        >
          <ScheduleActivities
            dateRange={selectedDateRange}
            selectedSchedule={selectedSchedule}
          />
        </div>
      </div>

      <style jsx>{`
        @media (min-width: 1024px) {
          .flex.flex-col.lg\\:grid {
            display: grid;
            grid-template-columns: ${calendarCollapsed ? "1fr" : "1fr 1fr"};
          }
        }
      `}</style>

      {/* Select Schedule Dialog */}
      <SelectScheduleDialog
        open={selectScheduleDialogOpen}
        onOpenChange={setSelectScheduleDialogOpen}
        onSelectSchedule={(schedule) => {
          // Ajustar las fechas del rango según el schedule seleccionado
          const startDate = new Date(schedule.scheduledAt);
          const endDate = schedule.endDate
            ? new Date(schedule.endDate)
            : new Date();

          setSelectedDateRange({
            start: startDate,
            end: endDate,
            type: "custom",
          });

          setSelectedSchedule({
            id: schedule.id,
            title: schedule.title,
            scheduledAt: schedule.scheduledAt,
            endDate: schedule.endDate,
          });
        }}
      />

      {/* Create Program or Incident Dialog - Dynamic based on view type and selected schedule */}
      {selectedSchedule || selectedDateRange.type === "day" ? (
        <CreateIncidentDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          selectedDate={selectedDateRange.start}
          selectedSchedule={selectedSchedule}
        />
      ) : (
        <CreateProgramDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          dateRange={selectedDateRange}
        />
      )}
    </PageContainer>
  );
}
