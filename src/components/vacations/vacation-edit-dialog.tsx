"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import {
  getVacationBalanceData,
  getVacationById,
  updateVacation,
  type VacationPeriodSummary,
} from "@/lib/actions/vacations";
import { isVacationPending } from "@/lib/constants/status-codes";
import { mxDateString } from "@/lib/utils/datetime";

type Props = {
  vacationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
};

export function VacationEditDialog({
  vacationId,
  open,
  onOpenChange,
  canManage,
}: Props) {
  const router = useRouter();
  const fieldId = useId();
  const [row, setRow] =
    useState<Awaited<ReturnType<typeof getVacationById>>>(null);
  const [periods, setPeriods] = useState<VacationPeriodSummary[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry restarts the scoped load even when its identity is unchanged.
  useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true);
    setRow(null);
    setError("");
    void (async () => {
      try {
        const fresh = await getVacationById(vacationId);
        if (!fresh?.active || !isVacationPending(fresh.status))
          throw new Error("Solo puede editar solicitudes pendientes activas.");
        const balance = await getVacationBalanceData(fresh.userId);
        if (isFailure(balance)) throw new Error(balance.error);
        if (!current) return;
        setRow(fresh);
        setStart(mxDateString(fresh.startDate));
        setEnd(mxDateString(fresh.endDate));
        setReason(fresh.reason ?? "");
        setPeriodId(fresh.periodId ?? "");
        setPeriods(balance.periods);
      } catch (failure) {
        if (current)
          setError(
            failure instanceof Error
              ? failure.message
              : "No se pudo cargar la solicitud.",
          );
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => {
      current = false;
    };
  }, [open, vacationId, generation]);

  const eligible = periods.filter(
    (period) =>
      start &&
      end &&
      start >= mxDateString(period.availableFrom ?? period.accrualStart) &&
      start >= mxDateString(period.accrualStart) &&
      end <= mxDateString(period.graceEnd) &&
      (!period.availableFrom || period.availableFrom <= new Date()),
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      title="Editar solicitud de vacaciones"
      description="El titular permanece igual. Los cambios se guardan solo si la solicitud sigue pendiente."
    >
      {loading && <output>Cargando solicitud...</output>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!loading && !row && (
        <Button
          variant="outline"
          onClick={() => setGeneration((value) => value + 1)}
        >
          Reintentar carga
        </Button>
      )}
      {row && (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!start || !end || end < start) {
              setError(
                "La fecha de fin debe ser igual o posterior a la fecha de inicio.",
              );
              return;
            }
            setSaving(true);
            setError("");
            try {
              const result = await updateVacation(vacationId, {
                startDate: new Date(`${start}T00:00:00Z`),
                endDate: new Date(`${end}T00:00:00Z`),
                reason: reason.trim() || null,
                ...(periodId ? { periodId } : {}),
              });
              if (isFailure(result)) {
                setError(result.error);
                return;
              }
              toast.success("Solicitud de vacaciones actualizada");
              onOpenChange(false);
              router.refresh();
            } catch {
              setError("No se pudo guardar la solicitud. Vuelva a intentar.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-holder`}>Titular</Label>
            <Input id={`${fieldId}-holder`} readOnly value={row.user.name} />
          </div>
          <fieldset disabled={saving} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-start`}>Fecha de inicio</Label>
                <Input
                  id={`${fieldId}-start`}
                  type="date"
                  required
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-end`}>Fecha de fin</Label>
                <Input
                  id={`${fieldId}-end`}
                  type="date"
                  required
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-period`}>Período de saldo</Label>
              <select
                id={`${fieldId}-period`}
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Asignar por vigencia y saldo</option>
                {periodId &&
                  !eligible.some((period) => period.id === periodId) && (
                    <option value={periodId}>
                      Período actual (revise la vigencia para las nuevas fechas)
                    </option>
                  )}
                {eligible.map((period) => (
                  <option key={period.id} value={period.id}>
                    Período {period.periodNumber} —{" "}
                    {period.remainingDays +
                      (period.id === row.periodId
                        ? (row.businessDaysUsed ?? 0)
                        : 0)}{" "}
                    días para reemplazar esta solicitud
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-reason`}>
                {canManage
                  ? "Motivo (obligatorio para fechas retroactivas)"
                  : "Motivo (opcional)"}
              </Label>
              <Textarea
                id={`${fieldId}-reason`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
              />
            </div>
          </fieldset>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      )}
    </ResponsiveDialog>
  );
}
