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
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { getScheduleById, quickUpdateSchedule } from "@/lib/actions/schedules";
import { fromDatetimeLocalMX, toDatetimeLocalMX } from "@/lib/utils/datetime";

interface ClienteOption {
  id: string;
  code: string;
  name: string;
}

interface QuickEditScheduleDialogProps {
  scheduleId: string | null;
  clientes: ClienteOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function QuickEditScheduleDialog({
  scheduleId,
  clientes,
  open,
  onOpenChange,
  onSaved,
}: QuickEditScheduleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clienteIds, setClienteIds] = useState<string[]>([]);
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
        setClienteIds(
          sched.clientes.filter((sv) => sv.active).map((sv) => sv.clienteId),
        );
        setScheduledAt(toDatetimeLocalMX(sched.scheduledAt));
        setEndDate(toDatetimeLocalMX(sched.endDate));
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(
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
    if (!scheduledAt) {
      setError("La fecha de inicio es requerida");
      return;
    }
    const start = fromDatetimeLocalMX(scheduledAt);
    const end = fromDatetimeLocalMX(endDate);
    if (!start) {
      setError("La fecha de inicio no es válida");
      return;
    }
    if (end && end < start) {
      setError("La fecha de fin no puede ser anterior a la fecha de inicio");
      return;
    }
    setSubmitting(true);
    try {
      const result = await quickUpdateSchedule(scheduleId, {
        clienteIds,
        scheduledAt: start,
        endDate: end,
      });

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      onSaved?.();
    } catch (e) {
      toast.error(
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
              ? `Actualiza Clientes y rango de fechas de "${title}".`
              : "Actualiza Clientes y rango de fechas de la programación."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="qe-clientes">Clientes</Label>
              <MultiSelect
                options={clientes.map((v) => ({
                  value: v.id,
                  label: `${v.code} — ${v.name}`,
                }))}
                value={clienteIds}
                onValueChange={setClienteIds}
                placeholder="Selecciona uno o varios Clientes"
                searchPlaceholder="Buscar Cliente..."
                emptyMessage="Sin Clientes disponibles"
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
