"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { getScheduleById, quickUpdateSchedule } from "@/lib/actions/schedules";

interface VicOption {
  id: string;
  code: string;
  name: string;
}

interface QuickEditScheduleDialogProps {
  scheduleId: string | null;
  vics: VicOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

function toDatetimeLocal(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function QuickEditScheduleDialog({
  scheduleId,
  vics,
  open,
  onOpenChange,
  onSaved,
}: QuickEditScheduleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vicIds, setVicIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [title, setTitle] = useState<string>("");

  useEffect(() => {
    if (!open || !scheduleId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getScheduleById(scheduleId)
      .then((sched) => {
        if (cancelled || !sched) return;
        setTitle(sched.title);
        setVicIds(sched.vics.filter((sv) => sv.active).map((sv) => sv.vicId));
        setScheduledAt(toDatetimeLocal(sched.scheduledAt));
        setEndDate(toDatetimeLocal(sched.endDate));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Error al cargar la programación",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, scheduleId]);

  const handleSave = async () => {
    if (!scheduleId) return;
    setError(null);
    if (vicIds.length === 0) {
      setError("Selecciona al menos un VIC");
      return;
    }
    if (!scheduledAt) {
      setError("La fecha de inicio es requerida");
      return;
    }
    const start = new Date(scheduledAt);
    const end = endDate ? new Date(endDate) : null;
    if (end && end < start) {
      setError("La fecha de fin no puede ser anterior a la fecha de inicio");
      return;
    }
    setSubmitting(true);
    try {
      await quickUpdateSchedule(scheduleId, {
        vicIds,
        scheduledAt: start,
        endDate: end,
      });
      onSaved?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al guardar la programación",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edición rápida</DialogTitle>
          <DialogDescription>
            {title
              ? `Actualiza VICs y rango de fechas de "${title}".`
              : "Actualiza VICs y rango de fechas de la programación."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="qe-vics">
                VICs <span className="text-red-500">*</span>
              </Label>
              <MultiSelect
                options={vics.map((v) => ({
                  value: v.id,
                  label: `${v.code} — ${v.name}`,
                }))}
                value={vicIds}
                onValueChange={setVicIds}
                placeholder="Selecciona uno o varios VICs"
                searchPlaceholder="Buscar VIC..."
                emptyMessage="Sin VICs disponibles"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qe-start">
                Fecha de inicio <span className="text-red-500">*</span>
              </Label>
              <Input
                id="qe-start"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qe-end">Fecha de fin (opcional)</Label>
              <Input
                id="qe-end"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive border border-destructive/40 bg-destructive/5 rounded px-3 py-2">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={submitting || loading}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
