"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VacationPeriodSummary } from "@/lib/actions/vacations";
import { APP_TZ } from "@/lib/utils/datetime";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Monday-first, matching the schedule calendar already in the app.
const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

export interface CalendarVacation {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  status: { name: string; color: string };
}

interface VacationYearCalendarProps {
  year: number;
  vacations: CalendarVacation[];
  /** "YYYY-MM-DD" holidays; shown as non-chargeable and not selectable. */
  holidayDates: string[];
  selectedPeriod: VacationPeriodSummary | null;
  onRequestRange: (startDate: string, endDate: string) => Promise<void>;
  onYearChange: (year: number) => void;
  readOnly?: boolean;
}

/** "YYYY-MM-DD" for a calendar day, built without UTC conversion. */
function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Same-day key for an instant, read in CDMX terms. */
function instantKey(value: Date | string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Leading blanks so the 1st lands under its weekday, Monday-first. */
function leadingBlanks(year: number, month: number): number {
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
  return firstDay === 0 ? 6 : firstDay - 1;
}

/**
 * Right-hand panel: the whole year at a glance so vacations can be planned
 * against holidays and days already booked.
 *
 * Day keys are built from the calendar fields directly rather than
 * `toISOString()`, which would shift a CDMX day into the previous one for
 * anyone west of UTC — the bug the schedule calendar still carries.
 *
 * Colors come from `VacationStatus.color` in the database rather than a
 * hardcoded map, so recoloring a status in the admin catalog is reflected here.
 */
export function VacationYearCalendar({
  year,
  vacations,
  holidayDates,
  selectedPeriod,
  onRequestRange,
  onYearChange,
  readOnly = false,
}: VacationYearCalendarProps) {
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const holidays = useMemo(() => new Set(holidayDates), [holidayDates]);

  // One lookup per day, so a cell knows its status without scanning every request.
  const vacationByDay = useMemo(() => {
    const map = new Map<string, CalendarVacation>();
    for (const vacation of vacations) {
      const cursor = new Date(instantKey(vacation.startDate));
      const last = new Date(instantKey(vacation.endDate));
      while (cursor <= last) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        map.set(key, vacation);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [vacations]);

  const periodWindow = useMemo(() => {
    if (!selectedPeriod) return null;
    return {
      start: instantKey(selectedPeriod.accrualStart),
      end: instantKey(selectedPeriod.graceEnd),
    };
  }, [selectedPeriod]);

  const isSelectable = (key: string): boolean => {
    if (readOnly || !periodWindow) return false;
    if (selectedPeriod?.isExpired) return false;
    if (vacationByDay.has(key)) return false;
    if (holidays.has(key)) return false;
    return key >= periodWindow.start && key <= periodWindow.end;
  };

  const isInDraftRange = (key: string): boolean => {
    if (!rangeStart) return false;
    const end = rangeEnd ?? rangeStart;
    const [lo, hi] = rangeStart <= end ? [rangeStart, end] : [end, rangeStart];
    return key >= lo && key <= hi;
  };

  const handleDayClick = (key: string) => {
    if (!isSelectable(key)) return;

    // First click opens a range, second closes it, a third starts over.
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(key);
      setRangeEnd(null);
      return;
    }
    if (key < rangeStart) {
      setRangeStart(key);
      return;
    }
    setRangeEnd(key);
  };

  const clearRange = () => {
    setRangeStart(null);
    setRangeEnd(null);
  };

  const submitRange = async () => {
    if (!rangeStart) return;
    setSubmitting(true);
    try {
      await onRequestRange(rangeStart, rangeEnd ?? rangeStart);
      clearRange();
    } finally {
      setSubmitting(false);
    }
  };

  const renderMonth = (month: number) => {
    const total = daysInMonth(year, month);
    const blanks = leadingBlanks(year, month);
    const todayKey = instantKey(new Date());

    return (
      <Card key={month} className="overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">
            {MONTH_NAMES[month]}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_INITIALS.map((initial, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday header
                key={index}
                className="text-[10px] font-medium text-muted-foreground"
              >
                {initial}
              </div>
            ))}

            {Array.from({ length: blanks }).map((_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length padding
              <div key={`blank-${index}`} />
            ))}

            {Array.from({ length: total }, (_, index) => index + 1).map(
              (day) => {
                const key = dayKey(year, month, day);
                const vacation = vacationByDay.get(key);
                const holiday = holidays.has(key);
                const selectable = isSelectable(key);
                const inDraft = isInDraftRange(key);
                const isToday = key === todayKey;

                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => handleDayClick(key)}
                    disabled={!selectable && !vacation}
                    title={
                      vacation
                        ? `${vacation.status.name}`
                        : holiday
                          ? "Día festivo"
                          : undefined
                    }
                    style={
                      vacation
                        ? {
                            backgroundColor: vacation.status.color,
                            color: "#fff",
                          }
                        : undefined
                    }
                    className={`aspect-square rounded text-[11px] transition-colors ${
                      vacation
                        ? "font-medium"
                        : inDraft
                          ? "bg-primary text-primary-foreground font-medium"
                          : holiday
                            ? "bg-muted text-muted-foreground line-through"
                            : selectable
                              ? "hover:bg-accent"
                              : "text-muted-foreground/40"
                    } ${isToday && !vacation && !inDraft ? "ring-1 ring-primary" : ""}`}
                  >
                    {day}
                  </button>
                );
              },
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onYearChange(year - 1)}
            title="Año anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-16 text-center text-lg font-semibold">
            {year}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onYearChange(year + 1)}
            title="Año siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[#F59E0B]" /> En revisión
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[#10B981]" /> Aprobada
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[#EF4444]" /> Rechazada
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-muted" /> Festivo
          </span>
        </div>
      </div>

      {!readOnly && !selectedPeriod && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Selecciona un período vacacional para poder apartar días.
        </p>
      )}

      {rangeStart && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-accent/50 p-3">
          <div className="text-sm">
            <span className="font-medium">
              {rangeStart}
              {rangeEnd && rangeEnd !== rangeStart ? ` → ${rangeEnd}` : ""}
            </span>
            <span className="ml-2 text-muted-foreground">
              {rangeEnd
                ? "Los días hábiles se descontarán del período seleccionado."
                : "Selecciona el día final o vuelve a enviar para un solo día."}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearRange}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submitRange} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Solicitar
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }, (_, month) => renderMonth(month))}
      </div>
    </div>
  );
}
