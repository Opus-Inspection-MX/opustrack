"use client";

import { Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface VIC {
  id: string;
  name: string;
  code: string;
}

interface IncidentType {
  id: number;
  name: string;
}

interface IncidentStatus {
  id: number;
  name: string;
}

interface CreateIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  selectedSchedule?: {
    id: string;
    title: string;
    scheduledAt: string;
    endDate: string | null;
  } | null;
}

export function CreateIncidentDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedSchedule,
}: CreateIncidentDialogProps) {
  const router = useRouter();
  const [vics, setVics] = useState<VIC[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [incidentStatuses, setIncidentStatuses] = useState<IncidentStatus[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "5",
    sla: "24",
    typeId: "",
    statusId: "",
    vicId: "",
    scheduledDate: "",
    scheduledTime: "09:00",
  });

  const fetchData = useCallback(async () => {
    try {
      const [vicsRes, typesRes, statusesRes] = await Promise.all([
        fetch("/api/vics"),
        fetch("/api/incident-types"),
        fetch("/api/incident-statuses"),
      ]);

      if (vicsRes.ok) {
        const vicsData = await vicsRes.json();
        setVics(vicsData.data || []);
      }

      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setIncidentTypes(typesData.data || []);
      }

      if (statusesRes.ok) {
        const statusesData = await statusesRes.json();
        setIncidentStatuses(statusesData.data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchData();
      // Set default date from selectedDate (using local timezone)
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const defaultDate = `${year}-${month}-${day}`;
      setFormData((prev) => ({ ...prev, scheduledDate: defaultDate }));
    }
  }, [open, selectedDate, fetchData]);

  // Validate that incident date/time falls within schedule's date range
  const validateDateRange = (date: string, time: string): boolean => {
    if (!selectedSchedule) {
      setDateRangeError(null);
      return true;
    }

    if (!date || !time) {
      setDateRangeError(null);
      return true;
    }

    const incidentDateTime = new Date(`${date}T${time}:00`);
    const scheduleStart = new Date(selectedSchedule.scheduledAt);

    // If schedule has an end date, validate against it
    if (selectedSchedule.endDate) {
      const scheduleEnd = new Date(selectedSchedule.endDate);

      if (incidentDateTime < scheduleStart || incidentDateTime > scheduleEnd) {
        setDateRangeError(
          `La fecha del incidente debe estar entre ${scheduleStart.toLocaleString(
            "es-MX",
            {
              dateStyle: "short",
              timeStyle: "short",
            },
          )} y ${scheduleEnd.toLocaleString("es-MX", {
            dateStyle: "short",
            timeStyle: "short",
          })}`,
        );
        return false;
      }
    } else {
      // If no end date, incident must be on or after schedule start
      if (incidentDateTime < scheduleStart) {
        setDateRangeError(
          `La fecha del incidente debe ser igual o posterior a ${scheduleStart.toLocaleString(
            "es-MX",
            {
              dateStyle: "short",
              timeStyle: "short",
            },
          )}`,
        );
        return false;
      }
    }

    setDateRangeError(null);
    return true;
  };

  // Validate whenever date or time changes
  useEffect(() => {
    if (formData.scheduledDate && formData.scheduledTime) {
      validateDateRange(formData.scheduledDate, formData.scheduledTime);
    }
  }, [formData.scheduledDate, formData.scheduledTime, validateDateRange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate date range if there's a selected schedule
    if (
      selectedSchedule &&
      !validateDateRange(formData.scheduledDate, formData.scheduledTime)
    ) {
      return;
    }

    setLoading(true);

    try {
      let scheduleId = selectedSchedule?.id;

      // Si no hay un schedule seleccionado, crear uno nuevo
      if (!scheduleId) {
        const scheduledDateTime = new Date(
          `${formData.scheduledDate}T${formData.scheduledTime}:00`,
        );

        const scheduleResponse = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            scheduledAt: scheduledDateTime.toISOString(),
            vicId: formData.vicId,
          }),
        });

        if (!scheduleResponse.ok) {
          throw new Error("Error al crear programación");
        }

        const scheduleData = await scheduleResponse.json();
        scheduleId = scheduleData.data.id;
      }

      // Crear el Incident asociado al Schedule (nuevo o seleccionado)
      const incidentResponse = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          priority: parseInt(formData.priority, 10),
          sla: parseInt(formData.sla, 10),
          typeId: parseInt(formData.typeId, 10),
          statusId: parseInt(formData.statusId, 10),
          vicId: formData.vicId,
          scheduleId: scheduleId,
        }),
      });

      if (!incidentResponse.ok) {
        throw new Error("Error al crear incidente");
      }

      // Reset form
      setFormData({
        title: "",
        description: "",
        priority: "5",
        sla: "24",
        typeId: "",
        statusId: "",
        vicId: "",
        scheduledDate: "",
        scheduledTime: "09:00",
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Error creating incident:", error);
      alert("Error al crear el incidente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        selectedSchedule
          ? "Nuevo Incidente en Programación"
          : "Nuevo Incidente Programado"
      }
      description={
        selectedSchedule
          ? `Crear incidente en la programación: ${selectedSchedule.title}`
          : "Crea un nuevo incidente con fecha de inicio programada"
      }
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {selectedSchedule && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                  Programación Seleccionada
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {selectedSchedule.title}
                </p>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 space-y-1">
                  <div>
                    <span className="font-medium">Inicio:</span>{" "}
                    {new Date(selectedSchedule.scheduledAt).toLocaleString(
                      "es-MX",
                      {
                        dateStyle: "short",
                        timeStyle: "short",
                      },
                    )}
                  </div>
                  {selectedSchedule.endDate && (
                    <div>
                      <span className="font-medium">Fin:</span>{" "}
                      {new Date(selectedSchedule.endDate).toLocaleString(
                        "es-MX",
                        {
                          dateStyle: "short",
                          timeStyle: "short",
                        },
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                  El incidente debe crearse dentro de este rango de fechas.
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">
            Título <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="Ej: Falla en sistema de frenos"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">
            Descripción <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Describe el incidente..."
            rows={4}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
          />
        </div>

        {/* VIC and Type */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vicId">
              VIC <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.vicId}
              onValueChange={(value) =>
                setFormData({ ...formData, vicId: value })
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un VIC" />
              </SelectTrigger>
              <SelectContent>
                {vics.map((vic) => (
                  <SelectItem key={vic.id} value={vic.id}>
                    {vic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="typeId">
              Tipo <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.typeId}
              onValueChange={(value) =>
                setFormData({ ...formData, typeId: value })
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tipo" />
              </SelectTrigger>
              <SelectContent>
                {incidentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Priority and Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="priority">
              Prioridad <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.priority}
              onValueChange={(value) =>
                setFormData({ ...formData, priority: value })
              }
              required
            >
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

          <div className="space-y-2">
            <Label htmlFor="statusId">
              Estado <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.statusId}
              onValueChange={(value) =>
                setFormData({ ...formData, statusId: value })
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona estado" />
              </SelectTrigger>
              <SelectContent>
                {incidentStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.id.toString()}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* SLA */}
        <div className="space-y-2">
          <Label htmlFor="sla">SLA (horas)</Label>
          <Input
            id="sla"
            type="number"
            value={formData.sla}
            onChange={(e) => setFormData({ ...formData, sla: e.target.value })}
            min="1"
          />
        </div>

        {/* Scheduled Date and Time */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">
                Fecha de Inicio <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="scheduledDate"
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledDate: e.target.value })
                  }
                  className="pl-10"
                  required
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledTime">
                Hora de Inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scheduledTime"
                type="time"
                value={formData.scheduledTime}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledTime: e.target.value })
                }
                required
              />
            </div>
          </div>
          {dateRangeError && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                {dateRangeError}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !!dateRangeError}>
            {loading ? "Creando..." : "Crear Incidente"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
