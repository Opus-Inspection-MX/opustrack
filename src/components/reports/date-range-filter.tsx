"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatMX,
  mxDayRange,
  mxDaysAgoString,
  mxTodayString,
} from "@/lib/utils/datetime";

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
}

const presets = [
  { label: "Hoy", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "Este ano", days: -1 }, // Special case for year to date
];

export function DateRangeFilter({
  startDate,
  endDate,
  onDateChange,
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Presets are calendar days in Mexico City. Deriving them from
  // `toISOString()` projected into UTC, so every afternoon after 18:00 CDMX the
  // range jumped a day ahead of what the buttons promised.
  const handlePresetClick = (days: number) => {
    const end = mxTodayString();
    let start: string;

    if (days === -1) {
      start = `${end.slice(0, 4)}-01-01`; // Year to date
    } else if (days === 0) {
      start = end; // Today
    } else {
      start = mxDaysAgoString(days);
    }

    onDateChange(start, end);
    setIsOpen(false);
  };

  const formatDisplayDate = (dateStr: string) => {
    // `dateStr` is a bare "YYYY-MM-DD", which `new Date()` reads as UTC
    // midnight — rendered without a zone that showed the previous day.
    return formatMX(mxDayRange(dateStr).gte, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">
            {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
          </span>
          <span className="sm:hidden">Fechas</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Rangos rapidos</h4>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Rango personalizado</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Desde</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => onDateChange(e.target.value, endDate)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Hasta</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => onDateChange(startDate, e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={() => setIsOpen(false)}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
