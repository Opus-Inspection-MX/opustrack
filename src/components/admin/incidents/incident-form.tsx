"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createIncident,
  type IncidentFormData,
  updateIncident,
} from "@/lib/actions/incidents";

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
    startedAt: Date | null;
    resolvedAt: Date | null;
    assigneeIds?: string[];
  };
  types: Array<{ id: number; name: string }>;
  statuses: Array<{ id: number; name: string }>;
  vics: Array<{ id: string; name: string; code: string }>;
  users: Array<{
    id: string;
    name: string;
    vicIds?: string[];
    roleName?: string | null;
  }>;
  schedules: Array<{ id: string; scheduledAt: Date }>;
};

export function IncidentForm({
  incident,
  types,
  statuses,
  vics,
  users,
  schedules,
}: IncidentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<IncidentFormData>({
    title: incident?.title || "",
    description: incident?.description || "",
    priority: incident?.priority || 5,
    sla: incident?.sla || 24,
    typeId: incident?.typeId || types[0]?.id || null,
    statusId: incident?.statusId || statuses[0]?.id || null,
    vicId: incident?.vicId || null,
    scheduleId: incident?.scheduleId || null,
    reportedById: incident?.reportedById || null,
    startedAt: incident?.startedAt || null,
    resolvedAt: incident?.resolvedAt || null,
    assigneeIds: incident?.assigneeIds || [],
  });

  const [startedAtString, setStartedAtString] = useState<string>(
    incident?.startedAt
      ? new Date(incident.startedAt).toISOString().slice(0, 16)
      : "",
  );
  const [resolvedAtString, setResolvedAtString] = useState<string>(
    incident?.resolvedAt
      ? new Date(incident.resolvedAt).toISOString().slice(0, 16)
      : "",
  );

  const fsrCandidates = users.filter((u) => {
    const isFsr = u.roleName === "FSR";
    if (!isFsr) return false;
    if (!formData.vicId) return true;
    return u.vicIds?.includes(formData.vicId);
  });

  useEffect(() => {
    const vicId = formData.vicId;
    if (!vicId) return;
    setFormData((prev) => {
      const allowed = users
        .filter((u) => u.roleName === "FSR" && u.vicIds?.includes(vicId))
        .map((u) => u.id);
      const filtered = (prev.assigneeIds ?? []).filter((id) =>
        allowed.includes(id),
      );
      if (filtered.length === (prev.assigneeIds ?? []).length) return prev;
      return { ...prev, assigneeIds: filtered };
    });
  }, [formData.vicId, users]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const submitData = {
        ...formData,
        startedAt: startedAtString ? new Date(startedAtString) : null,
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
                  setFormData({
                    ...formData,
                    priority: parseInt(e.target.value, 10) || 5,
                  })
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
                  setFormData({
                    ...formData,
                    sla: parseInt(e.target.value, 10) || 24,
                  })
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
                  setFormData({
                    ...formData,
                    typeId: value === "none" ? null : parseInt(value, 10),
                  })
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

            {/*
             * El estado de la incidencia se deriva de sus asignaciones
             * (state machine). No es editable manualmente desde aquí.
             */}

            <div className="space-y-2">
              <Label htmlFor="vicId">Centro de Verificacion</Label>
              <SearchableSelect
                options={[
                  { value: "none", label: "Sin CVV" },
                  ...vics.map((vic) => ({
                    value: vic.id,
                    label: `${vic.name} (${vic.code})`,
                  })),
                ]}
                value={formData.vicId || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    vicId: value === "none" ? null : value,
                  })
                }
                placeholder="Seleccionar CVV"
                searchPlaceholder="Buscar CVV..."
                emptyMessage="No se encontraron CVV."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reportedById">Reportado Por</Label>
              <SearchableSelect
                options={[
                  { value: "none", label: "Sin asignar" },
                  ...users.map((user) => ({
                    value: user.id,
                    label: user.name,
                  })),
                ]}
                value={formData.reportedById || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    reportedById: value === "none" ? null : value,
                  })
                }
                placeholder="Seleccionar usuario"
                searchPlaceholder="Buscar usuario..."
                emptyMessage="No se encontraron usuarios."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduleId">Programacion</Label>
            <SearchableSelect
              options={[
                { value: "none", label: "Sin programacion" },
                ...schedules.map((schedule) => ({
                  value: schedule.id,
                  label: new Date(schedule.scheduledAt).toLocaleString(),
                })),
              ]}
              value={formData.scheduleId || "none"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  scheduleId: value === "none" ? null : value,
                })
              }
              placeholder="Seleccionar programacion"
              searchPlaceholder="Buscar programacion..."
              emptyMessage="No se encontraron programaciones."
            />
          </div>

          <div className="space-y-2">
            <Label>FSRs Habilitados</Label>
            <MultiSelect
              options={fsrCandidates.map((u) => ({
                value: u.id,
                label: u.name,
              }))}
              value={formData.assigneeIds ?? []}
              onValueChange={(ids) =>
                setFormData({ ...formData, assigneeIds: ids })
              }
              placeholder={
                formData.vicId
                  ? "Seleccionar FSRs habilitados"
                  : "Selecciona un CVV para listar FSRs"
              }
              searchPlaceholder="Buscar FSR por nombre..."
              emptyMessage={
                formData.vicId
                  ? "No hay FSRs disponibles para este CVV"
                  : "Selecciona un CVV primero"
              }
              disabled={fsrCandidates.length === 0}
            />
            <p className="text-xs text-muted-foreground">
              Solo estos FSRs podrán asignarse en órdenes derivadas de este
              incidente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startedAt">Fecha de Inicio</Label>
              <Input
                id="startedAt"
                type="datetime-local"
                value={startedAtString}
                onChange={(e) => setStartedAtString(e.target.value)}
              />
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
          {loading
            ? "Guardando..."
            : incident
              ? "Actualizar Incidente"
              : "Crear Incidente"}
        </Button>
      </div>
    </form>
  );
}
