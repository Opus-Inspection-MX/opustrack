"use client";

import { Calendar, Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CreateScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: {
    start: Date;
    end: Date;
    type: "day" | "week" | "month" | "custom";
  };
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  dateRange,
}: CreateScheduleDialogProps) {
  const [scheduleType, setScheduleType] = useState<"day" | "week" | "month">(
    dateRange.type === "custom" ? "day" : dateRange.type,
  );
  const [activityType, setActivityType] = useState<
    "incident" | "calibration" | "maintenance"
  >("incident");

  // Ajustar fechas según el tipo de programación
  const getAdjustedDates = () => {
    const today = new Date();

    if (scheduleType === "month") {
      // Primer día del mes actual
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start, end };
    } else if (scheduleType === "week") {
      // Lunes de esta semana
      const day = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const diff = day === 0 ? -6 : 1 - day; // Ajustar para que comience en lunes
      const start = new Date(today);
      start.setDate(today.getDate() + diff);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      return { start, end };
    } else {
      // Día actual
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  };

  const adjustedDates = getAdjustedDates();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement schedule creation
    console.log("Create schedule", { scheduleType, activityType });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Programación</DialogTitle>
          <DialogDescription>
            Crea una nueva programación para actividades, calibraciones o
            mantenimientos
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Schedule Type */}
          <div className="space-y-2">
            <Label>Tipo de Programación</Label>
            <Select
              value={scheduleType}
              onValueChange={(v) =>
                setScheduleType(v as "day" | "week" | "month")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Día Específico</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Activity Type */}
          <div className="space-y-2">
            <Label>Tipo de Actividad</Label>
            <Select
              value={activityType}
              onValueChange={(v) =>
                setActivityType(v as "incident" | "calibration" | "maintenance")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incident">Incidente General</SelectItem>
                <SelectItem value="calibration">Calibración</SelectItem>
                <SelectItem value="maintenance">Mantenimiento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <div className="relative">
                <Input
                  type="date"
                  key={`start-${scheduleType}`}
                  defaultValue={adjustedDates.start.toISOString().split("T")[0]}
                  className="pl-10"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                {scheduleType === "month" && "Primer día del mes"}
                {scheduleType === "week" && "Lunes de la semana"}
                {scheduleType === "day" && "Día seleccionado"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <div className="relative">
                <Input
                  type="date"
                  key={`end-${scheduleType}`}
                  defaultValue={adjustedDates.end.toISOString().split("T")[0]}
                  className="pl-10"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                {scheduleType === "month" && "Último día del mes"}
                {scheduleType === "week" && "Domingo de la semana"}
                {scheduleType === "day" && "Mismo día"}
              </p>
            </div>
          </div>

          {/* Time */}
          {scheduleType === "day" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Inicio</Label>
                <div className="relative">
                  <Input type="time" className="pl-10" defaultValue="09:00" />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Hora Fin</Label>
                <div className="relative">
                  <Input type="time" className="pl-10" defaultValue="10:00" />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}

          {/* Cliente Selection */}
          <div className="space-y-2">
            <Label>Cliente (Centro de Verificación)</Label>
            <SearchableSelect
              options={[
                { value: "cliente-1", label: "Cliente CDMX Norte" },
                { value: "cliente-2", label: "Cliente CDMX Sur" },
                { value: "cliente-3", label: "Cliente Guadalajara" },
              ]}
              value=""
              onValueChange={() => {}}
              placeholder="Selecciona un Cliente"
              searchPlaceholder="Buscar Cliente..."
              emptyMessage="No se encontraron Clientes."
            />
          </div>

          {/* FSR Assignment */}
          <div className="space-y-2">
            <Label>Asignar FSR</Label>
            <SearchableSelect
              options={[
                { value: "fsr-1", label: "Juan Pérez" },
                { value: "fsr-2", label: "María González" },
                { value: "fsr-3", label: "Carlos Rodríguez" },
              ]}
              value=""
              onValueChange={() => {}}
              placeholder="Selecciona un FSR"
              searchPlaceholder="Buscar FSR..."
              emptyMessage="No se encontraron FSRs."
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Título</Label>
            <Input placeholder="Ej: Calibración de equipos" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              placeholder="Describe la actividad programada..."
              rows={4}
            />
          </div>

          {/* Priority (for incidents) */}
          {activityType === "incident" && (
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select defaultValue="5">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Muy Baja</SelectItem>
                  <SelectItem value="3">3 - Baja</SelectItem>
                  <SelectItem value="5">5 - Media</SelectItem>
                  <SelectItem value="7">7 - Alta</SelectItem>
                  <SelectItem value="10">10 - Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Equipment/Part (for calibrations and maintenance) */}
          {(activityType === "calibration" ||
            activityType === "maintenance") && (
            <div className="space-y-2">
              <Label>Equipo/Parte</Label>
              <SearchableSelect
                options={[
                  { value: "part-1", label: "Analizador de Gases" },
                  { value: "part-2", label: "Opacímetro" },
                  { value: "part-3", label: "Sistema de Frenos" },
                ]}
                value=""
                onValueChange={() => {}}
                placeholder="Selecciona equipo o parte"
                searchPlaceholder="Buscar equipo o parte..."
                emptyMessage="No se encontraron equipos."
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Crear Programación</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
