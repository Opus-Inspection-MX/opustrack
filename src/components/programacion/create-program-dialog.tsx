"use client";

import { Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

interface IncidentStatus {
  id: number;
  name: string;
  color: string;
}

interface CreateProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: {
    start: Date;
    end: Date;
    type: "day" | "week" | "month" | "custom";
  };
}

export function CreateProgramDialog({
  open,
  onOpenChange,
  dateRange,
}: CreateProgramDialogProps) {
  const router = useRouter();
  const [vics, setVics] = useState<VIC[]>([]);
  const [statuses, setStatuses] = useState<IncidentStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduledAt: "",
    scheduledTime: "09:00",
    endDate: "",
    endTime: "17:00",
    statusId: "",
    vicId: "",
  });

  useEffect(() => {
    if (open) {
      fetchData();
      // Set default dates from dateRange (using local timezone)
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const defaultStartDate = formatLocalDate(dateRange.start);
      const defaultEndDate = formatLocalDate(dateRange.end);
      setFormData((prev) => ({
        ...prev,
        scheduledAt: defaultStartDate,
        endDate: defaultEndDate,
      }));
    }
  }, [open, dateRange, fetchData]);

  const fetchData = async () => {
    try {
      const [vicsRes, statusesRes] = await Promise.all([
        fetch("/api/vics"),
        fetch("/api/incident-statuses"),
      ]);

      if (vicsRes.ok) {
        const vicsData = await vicsRes.json();
        setVics(vicsData.data || []);
      }

      if (statusesRes.ok) {
        const statusesData = await statusesRes.json();
        setStatuses(statusesData.data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Combinar fecha y hora
      const scheduledDateTime = new Date(
        `${formData.scheduledAt}T${formData.scheduledTime}:00`,
      );
      const endDateTime = formData.endDate
        ? new Date(`${formData.endDate}T${formData.endTime}:00`)
        : null;

      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          scheduledAt: scheduledDateTime.toISOString(),
          endDate: endDateTime?.toISOString() || null,
          statusId: formData.statusId ? parseInt(formData.statusId, 10) : null,
          vicId: formData.vicId,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al crear programación");
      }

      // Reset form
      setFormData({
        title: "",
        description: "",
        scheduledAt: "",
        scheduledTime: "09:00",
        endDate: "",
        endTime: "17:00",
        statusId: "",
        vicId: "",
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Error creating schedule:", error);
      alert("Error al crear la programación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva Programación"
      description="Crea una nueva programación para actividades del centro de verificación"
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">
            Título <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="Ej: Mantenimiento preventivo semanal"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            placeholder="Describe las actividades a realizar..."
            rows={4}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        {/* VIC Selection */}
        <div className="space-y-2">
          <Label htmlFor="vicId">
            Centro de Verificación (VIC){" "}
            <span className="text-destructive">*</span>
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
                  {vic.name} ({vic.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Start Date and Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">
              Fecha Inicio <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="scheduledAt"
                type="date"
                value={formData.scheduledAt}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledAt: e.target.value })
                }
                className="pl-10"
                required
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduledTime">
              Hora Inicio <span className="text-destructive">*</span>
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

        {/* End Date and Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="endDate">Fecha Fin</Label>
            <div className="relative">
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="pl-10"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">Hora Fin</Label>
            <Input
              id="endTime"
              type="time"
              value={formData.endTime}
              onChange={(e) =>
                setFormData({ ...formData, endTime: e.target.value })
              }
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="statusId">Estado</Label>
          <Select
            value={formData.statusId}
            onValueChange={(value) =>
              setFormData({ ...formData, statusId: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un estado" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={status.id.toString()}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Info message */}
        <div className="bg-muted p-3 rounded-lg text-sm">
          <p className="text-muted-foreground">
            Esta programación se creará para el rango de fechas:{" "}
            <strong>
              {dateRange.start.toLocaleDateString("es-MX")} -{" "}
              {dateRange.end.toLocaleDateString("es-MX")}
            </strong>
          </p>
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
          <Button type="submit" disabled={loading}>
            {loading ? "Creando..." : "Crear Programación"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
