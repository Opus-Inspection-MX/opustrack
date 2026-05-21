"use client";

import { Loader2, Pencil, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateIncidentFsrs } from "@/lib/actions/incidents";

interface FsrOption {
  id: string;
  name: string;
  email: string;
  vicIds: string[];
}

interface QuickEditFsrsPopoverProps {
  incidentId: number;
  incidentVicId: string | null;
  initialFsrIds: string[];
  allFsrs: FsrOption[];
  onSaved?: () => void;
}

export function QuickEditFsrsPopover({
  incidentId,
  incidentVicId,
  initialFsrIds,
  allFsrs,
  onSaved,
}: QuickEditFsrsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(initialFsrIds);

  // Filter FSRs by the incident's VIC. If incident has no VIC, show all.
  const fsrOptions = allFsrs
    .filter((f) => !incidentVicId || f.vicIds.includes(incidentVicId))
    .map((f) => ({
      value: f.id,
      label: f.name,
      sublabel: f.email,
    }));

  const handleSave = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await updateIncidentFsrs(incidentId, selected);
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
          setSelected(initialFsrIds);
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
          title="Editar FSRs"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Editar FSRs habilitados</p>
            <p className="text-xs text-muted-foreground">
              {incidentVicId
                ? "FSRs filtrados por el VIC del incidente."
                : "Sin VIC en el incidente — se muestran todos los FSRs."}
            </p>
          </div>
          <MultiSelect
            options={fsrOptions}
            value={selected}
            onValueChange={setSelected}
            placeholder="Selecciona FSRs"
            searchPlaceholder="Buscar FSR..."
            emptyMessage="Sin FSRs"
          />
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
