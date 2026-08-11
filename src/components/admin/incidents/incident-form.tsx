"use client";

import { isFailure } from "@/lib/actions/result";
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
    typeId: number | null;
    statusId: number | null;
    clienteId: string | null;
    scheduleId: string | null;
    reportedById: string | null;
    startedAt: Date | null;
    resolvedAt: Date | null;
    assigneeIds?: string[];
  };
  types: Array<{ id: number; name: string }>;
  statuses: Array<{ id: number; name: string }>;
  clientes: Array<{ id: string; name: string; code: string }>;
  users: Array<{
    id: string;
    name: string;
    clienteIds?: string[];
    roleName?: string | null;
  }>;
  schedules: Array<{ id: string; scheduledAt: Date }>;
};

export function IncidentForm({
  incident,
  types,
  statuses,
  clientes,
  users,
  schedules,
}: IncidentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<IncidentFormData>({
    title: incident?.title || "",
    description: incident?.description || "",
    typeId: incident?.typeId || types[0]?.id || null,
    statusId: incident?.statusId || statuses[0]?.id || null,
    clienteId: incident?.clienteId || null,
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
    if (!formData.clienteId) return true;
    return u.clienteIds?.includes(formData.clienteId);
  });

  useEffect(() => {
    const clienteId = formData.clienteId;
    if (!clienteId) return;
    setFormData((prev) => {
      const allowed = users
        .filter(
          (u) => u.roleName === "FSR" && u.clienteIds?.includes(clienteId),
        )
        .map((u) => u.id);
      const filtered = (prev.assigneeIds ?? []).filter((id) =>
        allowed.includes(id),
      );
      if (filtered.length === (prev.assigneeIds ?? []).length) return prev;
      return { ...prev, assigneeIds: filtered };
    });
  }, [formData.clienteId, users]);

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
        const result = await updateIncident(incident.id, submitData);

        if (isFailure(result)) {
          setError(result.error);
          return;
        }
      } else {
        const result = await createIncident(submitData);

        if (isFailure(result)) {
          setError(result.error);
          return;
        }
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clasificacion y Asignacion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="typeId">
                Tipo <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.typeId?.toString() || ""}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    typeId: value ? parseInt(value, 10) : null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="clienteId">Centro de Verificacion</Label>
              <SearchableSelect
                options={[
                  { value: "none", label: "Sin Cliente" },
                  ...clientes.map((cliente) => ({
                    value: cliente.id,
                    label: `${cliente.name} (${cliente.code})`,
                  })),
                ]}
                value={formData.clienteId || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    clienteId: value === "none" ? null : value,
                  })
                }
                placeholder="Seleccionar Cliente"
                searchPlaceholder="Buscar Cliente..."
                emptyMessage="No se encontraron Cliente."
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
                formData.clienteId
                  ? "Seleccionar FSRs habilitados"
                  : "Selecciona un Cliente para listar FSRs"
              }
              searchPlaceholder="Buscar FSR por nombre..."
              emptyMessage={
                formData.clienteId
                  ? "No hay FSRs disponibles para este Cliente"
                  : "Selecciona un Cliente primero"
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
