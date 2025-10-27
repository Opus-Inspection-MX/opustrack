"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createIncident, updateIncident, type IncidentFormData } from "@/lib/actions/incidents";

type IncidentFormProps = {
  incident?: {
    id: number;
    title: string;
    description: string;
    priority: number;
    sla: number;
    typeId: number | null;
    statusId: number | null;
    vicId: string | null;
    scheduleId: string | null;
    reportedById: string | null;
    resolvedAt: Date | null;
  };
  types: Array<{ id: number; name: string }>;
  statuses: Array<{ id: number; name: string }>;
  vics: Array<{ id: string; name: string; code: string }>;
  users: Array<{ id: string; name: string }>;
  schedules: Array<{ id: string; scheduledAt: Date }>;
};

export function IncidentForm({ incident, types, statuses, vics, users, schedules }: IncidentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<IncidentFormData>({
    title: incident?.title || "",
    description: incident?.description || "",
    priority: incident?.priority || 5,
    sla: incident?.sla || 24,
    typeId: incident?.typeId || (types[0]?.id || null),
    statusId: incident?.statusId || (statuses[0]?.id || null),
    vicId: incident?.vicId || null,
    scheduleId: incident?.scheduleId || null,
    reportedById: incident?.reportedById || null,
    resolvedAt: incident?.resolvedAt || null,
  });

  const [resolvedAtString, setResolvedAtString] = useState<string>(
    incident?.resolvedAt
      ? new Date(incident.resolvedAt).toISOString().slice(0, 16)
      : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const submitData = {
        ...formData,
        resolvedAt: resolvedAtString ? new Date(resolvedAtString) : null,
      };

      if (incident) {
        await updateIncident(incident.id, submitData);
      } else {
        await createIncident(submitData);
      }
      router.push("/admin/incidents");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informacion General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titulo *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Titulo del incidente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripcion *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descripcion detallada del incidente"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad (1-10) *</Label>
              <Input
                id="priority"
                type="number"
                min={1}
                max={10}
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sla">SLA (horas) *</Label>
              <Input
                id="sla"
                type="number"
                min={1}
                value={formData.sla}
                onChange={(e) =>
                  setFormData({ ...formData, sla: parseInt(e.target.value) || 24 })
                }
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clasificacion y Asignacion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="typeId">Tipo</Label>
              <Select
                value={formData.typeId?.toString() || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, typeId: value === "none" ? null : parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tipo</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statusId">Estado</Label>
              <Select
                value={formData.statusId?.toString() || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, statusId: value === "none" ? null : parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin estado</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vicId">Centro de Verificacion</Label>
              <Select
                value={formData.vicId || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, vicId: value === "none" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar VIC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin VIC</SelectItem>
                  {vics.map((vic) => (
                    <SelectItem key={vic.id} value={vic.id}>
                      {vic.name} ({vic.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reportedById">Reportado Por</Label>
              <Select
                value={formData.reportedById || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, reportedById: value === "none" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduleId">Programacion</Label>
            <Select
              value={formData.scheduleId || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, scheduleId: value === "none" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar programacion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin programacion</SelectItem>
                {schedules.map((schedule) => (
                  <SelectItem key={schedule.id} value={schedule.id}>
                    {new Date(schedule.scheduledAt).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolvedAt">Fecha de Resolucion</Label>
            <Input
              id="resolvedAt"
              type="datetime-local"
              value={resolvedAtString}
              onChange={(e) => setResolvedAtString(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : incident ? "Actualizar Incidente" : "Crear Incidente"}
        </Button>
      </div>
    </form>
  );
}
