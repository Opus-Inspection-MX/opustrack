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
import { toast } from "@/hooks/use-toast";
import { updateIncidentFsrs } from "@/lib/actions/incidents";
import { isFailure } from "@/lib/actions/result";

interface FsrOption {
  id: string;
  name: string;
  email: string;
}

interface QuickEditFsrsPopoverProps {
  incidentId: number;
  initialFsrIds: string[];
  allFsrs: FsrOption[];
  onSaved?: () => void;
}

export function QuickEditFsrsPopover({
  incidentId,
  initialFsrIds,
  allFsrs,
  onSaved,
}: QuickEditFsrsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialFsrIds);

  // FSR assignment is independent of the incident's Cliente — show all FSRs.
  const fsrOptions = allFsrs.map((f) => ({
    value: f.id,
    label: f.name,
    sublabel: f.email,
  }));

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const result = await updateIncidentFsrs(incidentId, selected);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
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
              Selecciona uno o varios FSR (búsqueda incluida).
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
