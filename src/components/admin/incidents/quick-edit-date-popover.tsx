"use client";

import { isFailure } from "@/lib/actions/result";
import { CalendarClock, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateIncidentScheduledDate } from "@/lib/actions/incidents";
import { localWallTimeToUTC, mxDateAndTime } from "@/lib/utils/datetime";

interface QuickEditDatePopoverProps {
  incidentId: number;
  /** Current scheduled start (ISO string) or null if none. */
  initialScheduledAt: string | null;
  onSaved?: () => void;
}

export function QuickEditDatePopover({
  incidentId,
  initialScheduledAt,
  onSaved,
}: QuickEditDatePopoverProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initial = mxDateAndTime(initialScheduledAt);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);

  const handleSave = async () => {
    setError(null);
    if (!date) {
      setError("Selecciona una fecha");
      return;
    }
    setSubmitting(true);
    try {
      const iso = localWallTimeToUTC(date, time || "00:00").toISOString();
      const result = await updateIncidentScheduledDate(incidentId, iso);

      if (isFailure(result)) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const reset = mxDateAndTime(initialScheduledAt);
          setDate(reset.date);
          setTime(reset.time);
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
          title="Editar fecha programada"
        >
          <CalendarClock className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Fecha programada de inicio</p>
            <p className="text-xs text-muted-foreground">
              Cambia la fecha y hora de inicio del incidente.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive border border-destructive/40 bg-destructive/5 rounded px-2 py-1">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-2 h-3 w-3" />
              )}
              Guardar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
