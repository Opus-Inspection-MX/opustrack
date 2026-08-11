"use client";

import { isFailure } from "@/lib/actions/result";
import { Loader2, Save, Tag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { updateIncidentType } from "@/lib/actions/incidents";

interface QuickEditTypePopoverProps {
  incidentId: number;
  initialTypeId: number | null;
  types: Array<{ id: number; name: string }>;
  onSaved?: () => void;
}

export function QuickEditTypePopover({
  incidentId,
  initialTypeId,
  types,
  onSaved,
}: QuickEditTypePopoverProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string>(
    initialTypeId ? String(initialTypeId) : "",
  );

  const handleSave = async () => {
    setError(null);
    if (!typeId) {
      setError("Selecciona un tipo");
      return;
    }
    setSubmitting(true);
    try {
      const result = await updateIncidentType(incidentId, Number.parseInt(typeId, 10));

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
          setTypeId(initialTypeId ? String(initialTypeId) : "");
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
          title="Editar tipo de incidente"
        >
          <Tag className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Tipo de incidente</p>
          </div>
          <SearchableSelect
            options={types.map((t) => ({
              value: String(t.id),
              label: t.name,
            }))}
            value={typeId}
            onValueChange={setTypeId}
            placeholder="Selecciona tipo"
            searchPlaceholder="Buscar tipo..."
            emptyMessage="Sin tipos"
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
