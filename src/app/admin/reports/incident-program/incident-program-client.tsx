"use client";

import { AlertTriangle, Download, ListChecks, Loader2 } from "lucide-react";
import moment from "moment-timezone";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  getIncidentProgramReport,
  getScheduleOptions,
} from "@/lib/actions/incident-program";
import {
  HOLIDAY_CELL_LABEL,
  type IncidentProgramReport,
  type ProgramRow,
  type ProgramWeek,
  type ScheduleOption,
} from "@/lib/reports/incident-program/types";

interface ClienteOption {
  id: string;
  code: string;
  name: string;
  stateId: number;
}

interface StateOption {
  id: number;
  code: string;
  name: string;
}

interface Props {
  initialReport: IncidentProgramReport;
  initialSchedules: ScheduleOption[];
  /** `YYYY-MM-DD`. */
  initialStartDate: string;
  initialEndDate: string;
  clientes: ClienteOption[];
  states: StateOption[];
}

/** Quick range presets, expressed against the current CDMX date. */
const PRESETS = [
  { label: "Este mes", months: 0 },
  { label: "Mes anterior", months: -1 },
] as const;

/**
 * Preview colours mirror the workbook fills so what the admin sees on screen
 * matches the generated file (see `lib/reports/incident-program/excel.ts`).
 */
const CELL_STYLE: Record<ProgramRow["kind"], string> = {
  CENTRO: "bg-[#92D050] font-bold italic text-black",
  MANTENIMIENTO: "bg-white text-black",
  CALIBRACION_FASE_II: "bg-[#E59EDD] text-black",
  CAL_OPACIMETRO_GASES: "bg-[#E59EDD] text-black",
  INCIDENCIAS: "bg-white text-black",
  VACACIONES: "bg-white text-black",
};

/** Read the download name the server chose, preferring the RFC 5987 form. */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) return decodeURIComponent(encoded[1]);
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : null;
}

function cellClass(row: ProgramRow, value: string | null): string {
  if (value === null) return "bg-white text-black";
  if (row.kind === "CENTRO" && value === HOLIDAY_CELL_LABEL) {
    return "bg-[#FFFF00] font-bold italic text-black";
  }
  return CELL_STYLE[row.kind];
}

function scheduleDateLabel(option: ScheduleOption): string {
  if (!option.startDate) return "Sin fecha";
  if (!option.endDate || option.endDate === option.startDate) {
    return option.startDate;
  }
  return `${option.startDate} → ${option.endDate}`;
}

function WeekBlock({ week }: { week: ProgramWeek }) {
  return (
    <table className="w-full border-collapse text-[11px] leading-tight">
      <tbody>
        <tr>
          <th className="w-56 border border-black bg-[#DCEAF7] px-2 py-1 text-left font-bold text-black">
            DIA
          </th>
          {week.days.map((day) => (
            <th
              key={`d-${day.date}`}
              className="border border-black bg-[#DCEAF7] px-2 py-1 text-center font-bold text-black"
            >
              {day.weekday}
            </th>
          ))}
        </tr>
        <tr>
          <th className="border border-black bg-[#DCEAF7] px-2 py-1 text-left font-bold text-black">
            FECHA
          </th>
          {week.days.map((day) => (
            <th
              key={`f-${day.date}`}
              className={`border border-black bg-[#DCEAF7] px-2 py-1 text-center font-bold text-black ${
                day.inRange ? "" : "opacity-50"
              }`}
            >
              {day.dayOfMonth}
            </th>
          ))}
        </tr>
        {week.rows.map((row, rowIndex) => (
          <tr key={`${row.kind}-${rowIndex}-${week.days[0].date}`}>
            <th className="border border-black bg-white px-2 py-1 text-left align-middle font-bold text-black">
              {row.label.trim()}
            </th>
            {row.cells.map((value, i) => (
              <td
                key={`${row.kind}-${rowIndex}-${week.days[i].date}`}
                className={`border border-black px-2 py-1 text-center align-middle ${cellClass(row, value)}`}
              >
                {value ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function IncidentProgramClient({
  initialReport,
  initialSchedules,
  initialStartDate,
  initialEndDate,
  clientes,
  states,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState(initialReport);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  // Empty array = no restriction ("todos los estados" / "todos los centros").
  const [stateIds, setStateIds] = useState<string[]>([]);
  const [clienteIds, setClienteIds] = useState<string[]>([]);
  // Empty set = no restriction ("todas las programaciones").
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const rangeIsValid = Boolean(startDate && endDate && startDate <= endDate);
  const allSelected =
    schedules.length > 0 && selectedIds.size === schedules.length;

  const stateOptions: MultiSelectOption[] = states.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // The centro list follows the selected plazas, so the operator only sees
  // the centros that can appear in this report.
  const clienteOptions: MultiSelectOption[] = clientes
    .filter(
      (c) => stateIds.length === 0 || stateIds.includes(String(c.stateId)),
    )
    .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }));

  const buildFilters = (next: {
    startDate: string;
    endDate: string;
    stateIds: string[];
    clienteIds: string[];
    selectedIds: Set<string>;
  }) => ({
    startDate: next.startDate,
    endDate: next.endDate,
    stateIds: next.stateIds.length > 0 ? next.stateIds.map(Number) : undefined,
    clienteIds: next.clienteIds.length > 0 ? next.clienteIds : undefined,
    scheduleIds: next.selectedIds.size > 0 ? [...next.selectedIds] : undefined,
  });

  /** Reload the report only — the schedule list is unaffected by the picker. */
  const reloadReport = (next: Parameters<typeof buildFilters>[0]) => {
    if (next.startDate > next.endDate) return;
    startTransition(async () => {
      try {
        setReport(await getIncidentProgramReport(buildFilters(next)));
      } catch {
        toast.error("No se pudo generar el reporte. Intenta de nuevo.");
      }
    });
  };

  /**
   * Reload both the schedule list and the report. Used whenever the scope
   * changes (range, plaza, centro), since those redefine which programaciones
   * are available — any previous selection would be stale.
   */
  const reloadScope = (next: Parameters<typeof buildFilters>[0]) => {
    if (next.startDate > next.endDate) return;
    const filters = buildFilters({ ...next, selectedIds: new Set() });
    startTransition(async () => {
      try {
        const [nextSchedules, nextReport] = await Promise.all([
          getScheduleOptions({
            startDate: filters.startDate,
            endDate: filters.endDate,
            stateIds: filters.stateIds,
            clienteIds: filters.clienteIds,
          }),
          getIncidentProgramReport({ ...filters, scheduleIds: undefined }),
        ]);
        setSchedules(nextSchedules);
        setSelectedIds(new Set());
        setReport(nextReport);
      } catch {
        toast.error("No se pudo cargar la lista de programaciones.");
      }
    });
  };

  const currentScope = {
    startDate,
    endDate,
    stateIds,
    clienteIds,
    selectedIds,
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    reloadScope({ ...currentScope, startDate: value });
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    reloadScope({ ...currentScope, endDate: value });
  };

  const handlePreset = (monthsAgo: number) => {
    const base = moment().add(monthsAgo, "month");
    const nextStart = base.clone().startOf("month").format("YYYY-MM-DD");
    const nextEnd = base.clone().endOf("month").format("YYYY-MM-DD");
    setStartDate(nextStart);
    setEndDate(nextEnd);
    reloadScope({
      ...currentScope,
      startDate: nextStart,
      endDate: nextEnd,
    });
  };

  const handleStateChange = (value: string[]) => {
    setStateIds(value);
    // Centros from a plaza no longer selected would contradict the new
    // filter — drop them, keeping any that still belong to `value`.
    const validClienteIds =
      value.length === 0
        ? clienteIds
        : clienteIds.filter((id) => {
            const cliente = clientes.find((c) => c.id === id);
            return cliente && value.includes(String(cliente.stateId));
          });
    setClienteIds(validClienteIds);
    reloadScope({
      ...currentScope,
      stateIds: value,
      clienteIds: validClienteIds,
    });
  };

  const handleClienteChange = (value: string[]) => {
    setClienteIds(value);
    reloadScope({ ...currentScope, clienteIds: value });
  };

  const toggleSchedule = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
    reloadReport({ ...currentScope, selectedIds: next });
  };

  const toggleAll = () => {
    const next = allSelected
      ? new Set<string>()
      : new Set(schedules.map((s) => s.id));
    setSelectedIds(next);
    reloadReport({ ...currentScope, selectedIds: next });
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (stateIds.length > 0) params.set("stateIds", stateIds.join(","));
      if (clienteIds.length > 0) {
        params.set("clienteIds", clienteIds.join(","));
      }
      if (selectedIds.size > 0) {
        params.set("scheduleIds", [...selectedIds].join(","));
      }

      const response = await fetch(
        `/api/reports/incident-program?${params.toString()}`,
      );
      if (!response.ok) throw new Error(String(response.status));

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        filenameFromDisposition(response.headers.get("Content-Disposition")) ??
        `Incidentes ${startDate} a ${endDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo descargar el archivo de Excel.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <ListChecks className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Reporte de Incidentes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Incidentes por programación, en el formato de reportería de la
              operación.
            </p>
          </div>
        </div>

        <Button
          onClick={handleDownload}
          disabled={isDownloading || isPending || !rangeIsValid}
        >
          {isDownloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Descargar Excel
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="program-start">Desde</Label>
          <Input
            id="program-start"
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="w-[170px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="program-end">Hasta</Label>
          <Input
            id="program-end"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            className="w-[170px]"
          />
        </div>
        <div className="flex gap-2 pb-0.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => handlePreset(preset.months)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="program-state">Estado</Label>
          <MultiSelect
            options={stateOptions}
            value={stateIds}
            onValueChange={handleStateChange}
            placeholder="Todos los estados"
            searchPlaceholder="Buscar estado..."
            emptyMessage="Sin estados"
            className="w-[220px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="program-cliente">Centro</Label>
          <MultiSelect
            options={clienteOptions}
            value={clienteIds}
            onValueChange={handleClienteChange}
            placeholder="Todos los centros"
            searchPlaceholder="Buscar centro..."
            emptyMessage="Sin centros"
            className="w-[260px]"
          />
        </div>
      </div>

      {!rangeIsValid && (
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" />
          La fecha inicial no puede ser posterior a la final.
        </p>
      )}

      {/* Schedule picker */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="select-all-schedules"
              checked={allSelected}
              disabled={schedules.length === 0}
              onCheckedChange={toggleAll}
            />
            <Label
              htmlFor="select-all-schedules"
              className="cursor-pointer font-medium"
            >
              Seleccionar todo
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedIds.size === 0
              ? `Todas las programaciones (${schedules.length})`
              : `${selectedIds.size} de ${schedules.length} seleccionadas`}
          </p>
        </div>

        {schedules.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No hay programaciones con incidentes en este rango.
          </p>
        ) : (
          <ScrollArea className="h-[260px]">
            <ul className="divide-y">
              {schedules.map((option) => (
                <li key={option.id}>
                  {/* Radix renders a button, so the label needs an explicit
                      htmlFor to stay associated with it. */}
                  <label
                    htmlFor={`schedule-${option.id}`}
                    className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`schedule-${option.id}`}
                      checked={selectedIds.has(option.id)}
                      onCheckedChange={() => toggleSchedule(option.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {option.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {scheduleDateLabel(option)}
                        {option.clienteCodes.length > 0 &&
                          ` · ${option.clienteCodes.join(", ")}`}
                      </span>
                    </span>
                    <Badge variant="secondary">
                      {option.incidentCount}{" "}
                      {option.incidentCount === 1 ? "incidente" : "incidentes"}
                    </Badge>
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>

      {/* Preview */}
      <div className="overflow-x-auto rounded-lg border bg-white p-4">
        <div className="min-w-[900px] space-y-6">
          <div className="border border-black bg-[#BFBFBF] py-1 text-center text-sm font-bold tracking-[0.2em] text-black">
            {report.title}
          </div>

          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando reporte...
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {report.incidentCount}{" "}
                {report.incidentCount === 1
                  ? "incidente en el reporte"
                  : "incidentes en el reporte"}
              </p>
              {report.weeks.map((week) => (
                <WeekBlock key={week.days[0].date} week={week} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
