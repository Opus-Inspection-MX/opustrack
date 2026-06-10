"use client";

import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import {
  type BulkAssignChanges,
  bulkAssignIncidents,
} from "@/lib/actions/incidents";

export interface BulkAssignOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface BulkAssignDialogProps {
  incidentIds: number[];
  clientes: BulkAssignOption[];
  schedules: BulkAssignOption[];
  fsrs: BulkAssignOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (count: number) => void;
}

export function BulkAssignDialog({
  incidentIds,
  clientes,
  schedules,
  fsrs,
  open,
  onOpenChange,
  onSaved,
}: BulkAssignDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<
    Array<{ incidentId: number; message: string }>
  >([]);

  const [modifySchedule, setModifySchedule] = useState(false);
  const [scheduleValue, setScheduleValue] = useState<string>("");

  const [modifyCliente, setModifyCliente] = useState(false);
  const [clienteValue, setClienteValue] = useState<string>("");

  const [modifyFsrs, setModifyFsrs] = useState(false);
  const [fsrValues, setFsrValues] = useState<string[]>([]);
  const [fsrMode, setFsrMode] = useState<"replace" | "append">("replace");

  const reset = () => {
    setModifySchedule(false);
    setModifyCliente(false);
    setModifyFsrs(false);
    setScheduleValue("");
    setClienteValue("");
    setFsrValues([]);
    setFsrMode("replace");
    setErrors([]);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSave = async () => {
    setErrors([]);
    if (!modifySchedule && !modifyCliente && !modifyFsrs) {
      setErrors([
        { incidentId: 0, message: "Activa al menos un campo para modificar" },
      ]);
      return;
    }
    if (modifyCliente && !clienteValue) {
      setErrors([{ incidentId: 0, message: "Selecciona un Cliente" }]);
      return;
    }
    const changes: BulkAssignChanges = {};
    if (modifySchedule) {
      changes.scheduleId = scheduleValue === "__clear__" ? null : scheduleValue;
    }
    if (modifyCliente) {
      changes.clienteId = clienteValue;
    }
    if (modifyFsrs) {
      changes.fsrIds = { ids: fsrValues, mode: fsrMode };
    }

    setSubmitting(true);
    try {
      const result = await bulkAssignIncidents(incidentIds, changes);
      if (result.ok) {
        onSaved?.(result.updated);
        reset();
        onOpenChange(false);
      } else {
        setErrors(result.errors);
      }
    } catch (e) {
      setErrors([
        {
          incidentId: 0,
          message: e instanceof Error ? e.message : "Error al guardar",
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const scheduleOptions = [
    { value: "__clear__", label: "— Quitar programación —" },
    ...schedules,
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Asignar en masa</DialogTitle>
          <DialogDescription>
            {incidentIds.length} incidente
            {incidentIds.length === 1 ? "" : "s"} seleccionado
            {incidentIds.length === 1 ? "" : "s"}. Activa los campos que quieras
            modificar; los demás no se tocan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Programación */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-schedule-switch">Programación</Label>
              <Switch
                id="bulk-schedule-switch"
                checked={modifySchedule}
                onCheckedChange={setModifySchedule}
              />
            </div>
            {modifySchedule && (
              <SearchableSelect
                options={scheduleOptions}
                value={scheduleValue}
                onValueChange={setScheduleValue}
                placeholder="Elige programación"
                searchPlaceholder="Buscar programación..."
                emptyMessage="Sin programaciones"
              />
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-cliente-switch">Cliente</Label>
              <Switch
                id="bulk-cliente-switch"
                checked={modifyCliente}
                onCheckedChange={setModifyCliente}
              />
            </div>
            {modifyCliente && (
              <>
                <SearchableSelect
                  options={clientes}
                  value={clienteValue}
                  onValueChange={setClienteValue}
                  placeholder="Elige Cliente"
                  searchPlaceholder="Buscar Cliente..."
                  emptyMessage="Sin Clientes"
                />
                <p className="text-xs text-muted-foreground">
                  Cambiar el Cliente puede invalidar FSRs ya asignados al
                  incidente — se rechazará la fila si quedan FSRs incompatibles.
                </p>
              </>
            )}
          </div>

          {/* FSRs */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-fsrs-switch">FSRs habilitados</Label>
              <Switch
                id="bulk-fsrs-switch"
                checked={modifyFsrs}
                onCheckedChange={setModifyFsrs}
              />
            </div>
            {modifyFsrs && (
              <>
                <MultiSelect
                  options={fsrs.map((f) => ({
                    value: f.value,
                    label: f.label,
                    sublabel: f.sublabel,
                  }))}
                  value={fsrValues}
                  onValueChange={setFsrValues}
                  placeholder="Selecciona FSRs"
                  searchPlaceholder="Buscar FSR..."
                  emptyMessage="Sin FSRs"
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Modo:{" "}
                    {fsrMode === "replace"
                      ? "Reemplazar"
                      : "Agregar a los existentes"}
                  </span>
                  <Switch
                    checked={fsrMode === "append"}
                    onCheckedChange={(v) =>
                      setFsrMode(v ? "append" : "replace")
                    }
                  />
                </div>
              </>
            )}
          </div>

          {errors.length > 0 && (
            <div className="rounded border border-destructive/50 bg-destructive/5 p-3 text-sm space-y-1">
              <p className="font-medium text-destructive">Errores:</p>
              <ul className="list-disc pl-5">
                {errors.map((e, i) => (
                  <li key={`${e.incidentId}-${i}`}>
                    {e.incidentId > 0 ? `Incidente ${e.incidentId}: ` : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {submitting ? "Guardando..." : "Aplicar a seleccionados"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
