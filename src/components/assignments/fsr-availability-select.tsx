"use client";

import { Button } from "@/components/ui/button";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import type { useFsrAvailability } from "@/hooks/use-fsr-availability";

type Props = {
  id: string;
  options: MultiSelectOption[];
  selectedOptions?: MultiSelectOption[];
  value: string[];
  onValueChange: (ids: string[]) => void;
  availability: ReturnType<typeof useFsrAvailability>;
  scheduledDate: string | null;
  disabled?: boolean;
};

export function FsrAvailabilitySelect({
  id,
  options,
  selectedOptions = [],
  value,
  onValueChange,
  availability,
  scheduledDate,
  disabled,
}: Props) {
  const identities = new Map(
    [...selectedOptions, ...options].map((option) => [option.value, option]),
  );
  const rows = new Map(availability.fsrs.map((fsr) => [fsr.userId, fsr]));
  const candidateIds =
    availability.state === "ready"
      ? [
          ...options
            .filter((option) => rows.has(option.value))
            .map((option) => option.value),
          ...availability.fsrs.map((fsr) => fsr.userId),
        ]
      : options.map((option) => option.value);
  const ids = [...new Set([...candidateIds, ...value])];
  const projected = ids.map((userId): MultiSelectOption => {
    const row = rows.get(userId);
    const identity = identities.get(userId) ?? {
      value: userId,
      label: row?.name ?? userId,
    };
    const disabledReason =
      availability.state !== "ready"
        ? "Disponibilidad sin confirmar"
        : !row
          ? "Técnico no disponible para nuevas asignaciones"
          : row.reason === "HOLIDAY"
            ? "Día festivo"
            : row.reason === "APPROVED_ABSENCE"
              ? "Ausencia aprobada"
              : undefined;
    return { ...identity, disabled: Boolean(disabledReason), disabledReason };
  });

  return (
    <div className="space-y-2">
      <MultiSelect
        id={id}
        options={projected}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        placeholder="Seleccionar FSRs"
        searchPlaceholder="Buscar FSR..."
      />
      <div aria-live="polite">
        {availability.state === "loading" && (
          <p className="text-xs text-muted-foreground">
            Consultando disponibilidad…
          </p>
        )}
        {availability.state === "ready" && scheduledDate === null && (
          <p className="text-xs text-muted-foreground">
            Sin fecha programada: la disponibilidad se validará al ejecutar el
            trabajo.
          </p>
        )}
        {availability.state === "error" && (
          <div className="space-y-1">
            <p role="alert" className="text-xs text-destructive">
              {availability.error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={availability.retry}
              disabled={disabled}
            >
              Reintentar disponibilidad
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
