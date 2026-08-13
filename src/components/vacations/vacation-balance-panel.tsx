"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import type { VacationPeriodSummary } from "@/lib/actions/vacations";
import { updatePeriodOverride } from "@/lib/actions/vacations";
import { formatMX } from "@/lib/utils/datetime";

interface VacationBalancePanelProps {
  periods: VacationPeriodSummary[];
  selectedPeriodId: string | null;
  onSelectPeriod: (periodId: string) => void;
  /** Shows the day-allotment editor. Server still enforces vacations:manage. */
  canManage?: boolean;
  hasHireDate: boolean;
  onChanged?: () => void;
}

/** One period's day counts, and the admin control to correct the allotment. */
function PeriodCard({
  period,
  isSelected,
  onSelect,
  canManage,
  onChanged,
}: {
  period: VacationPeriodSummary;
  isSelected: boolean;
  onSelect: () => void;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(period.allottedDays));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const parsed = Number(draft);
      if (!Number.isInteger(parsed) || parsed < 0) {
        toast.error("Los días asignados deben ser un número entero positivo.");
        return;
      }

      const result = await updatePeriodOverride(period.id, parsed);
      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }

      toast.success(`Días del período ${period.periodNumber} actualizados`);
      setEditing(false);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const yearLabel = `${new Date(period.accrualStart).getFullYear()}–${new Date(
    period.accrualEnd,
  ).getFullYear()}`;

  return (
    // The selectable area is its own button rather than wrapping the whole
    // card: the admin controls below are buttons too, and nesting them would be
    // invalid HTML that swallows their clicks.
    <div
      className={`rounded-lg border transition-colors ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "hover:bg-accent"
      } ${period.isExpired ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">Año {period.periodNumber}</p>
            <p className="text-xs text-muted-foreground">{yearLabel}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {period.isExpired && (
              <Badge variant="outline" className="text-xs">
                Vencido
              </Badge>
            )}
            {period.isOverridden && (
              <Badge variant="secondary" className="text-xs">
                Ajustado
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums">
            {period.remainingDays}
          </span>
          <span className="text-sm text-muted-foreground">
            / {period.allottedDays} días disponibles
          </span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {period.usedDays} día(s) solicitados o aprobados
        </p>

        <p className="mt-2 text-xs text-muted-foreground">
          Vigencia hasta {formatMX(period.graceEnd, { dateStyle: "medium" })}
        </p>
      </button>

      {canManage && (
        <div className="mx-4 mb-4 border-t pt-3">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-8 w-24"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={save}
                disabled={saving}
                title="Guardar"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  setDraft(String(period.allottedDays));
                  setEditing(false);
                }}
                disabled={saving}
                title="Cancelar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              className="h-8"
            >
              <Pencil className="mr-2 h-3 w-3" />
              Ajustar días
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Left-hand panel: how many days each period grants, spends and has left.
 *
 * Every number here is derived server-side from the period's allotment minus
 * what existing requests reserve, so raising the allotment can only add days —
 * it never disturbs vacations already booked.
 */
export function VacationBalancePanel({
  periods,
  selectedPeriodId,
  onSelectPeriod,
  canManage = false,
  hasHireDate,
  onChanged,
}: VacationBalancePanelProps) {
  if (!hasHireDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Días de vacaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Este usuario no tiene fecha de contratación registrada. Un
            administrador debe capturarla para calcular sus períodos y días de
            vacaciones.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (periods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Días de vacaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay períodos vacacionales generados. Revisa que exista una regla
            de días configurada para los años de servicio de este usuario.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Días de vacaciones</CardTitle>
        <p className="text-sm text-muted-foreground">
          Selecciona un período para apartar días en el calendario.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {[...periods].reverse().map((period) => (
          <PeriodCard
            key={period.id}
            period={period}
            isSelected={period.id === selectedPeriodId}
            onSelect={() => onSelectPeriod(period.id)}
            canManage={canManage}
            onChanged={onChanged}
          />
        ))}
      </CardContent>
    </Card>
  );
}
