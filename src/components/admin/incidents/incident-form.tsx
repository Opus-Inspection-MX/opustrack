"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { isFailure } from "@/lib/actions/result";
import {
  formatMX,
  fromDatetimeLocalMX,
  toDatetimeLocalMX,
} from "@/lib/utils/datetime";

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
    reporterName?: string | null;
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
    /**
     * Required, not optional. It used to be a singular `roleName?`, and when
     * multi-role renamed it the filter below started reading `undefined` on
     * every user — the FSR list came up empty and nobody could be assigned.
     * An optional field that stops existing produces no type error, so the
     * compiler said nothing. Mandatory here means it will.
     */
    roleNames: string[];
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
    reporterName: incident?.reporterName || "",
    startedAt: incident?.startedAt || null,
    resolvedAt: incident?.resolvedAt || null,
    assigneeIds: incident?.assigneeIds || [],
  });

  const [startedAtString, setStartedAtString] = useState<string>(
    incident?.startedAt ? toDatetimeLocalMX(incident.startedAt) : "",
  );
  const [resolvedAtString, setResolvedAtString] = useState<string>(
    incident?.resolvedAt ? toDatetimeLocalMX(incident.resolvedAt) : "",
  );

  // Every FSR, not just the ones linked to this incident's Cliente: that link
  // is a hint for the picker, never a filter.
  const fsrCandidates = users.filter((u) => u.roleNames.includes("FSR"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const submitData = {
        ...formData,
        startedAt: fromDatetimeLocalMX(startedAtString),
        resolvedAt: fromDatetimeLocalMX(resolvedAtString),
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
              <p className="text-xs text-muted-foreground">
                La cuenta del centro. La persona concreta va en el campo
                siguiente.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reporterName">Nombre de quien reporta</Label>
              <Input
                id="reporterName"
                value={formData.reporterName ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, reporterName: e.target.value })
                }
                placeholder="Persona que levantó el reporte"
                maxLength={120}
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
                  label: formatMX(schedule.scheduledAt),
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
                // The Cliente link is shown, never applied: it tells the
                // operator who usually covers that center.
                badge:
                  formData.clienteId &&
                  u.clienteIds?.includes(formData.clienteId)
                    ? "Cliente asignado"
                    : undefined,
              }))}
              value={formData.assigneeIds ?? []}
              onValueChange={(ids) =>
                setFormData({ ...formData, assigneeIds: ids })
              }
              placeholder="Seleccionar FSRs habilitados"
              searchPlaceholder="Buscar FSR por nombre..."
              emptyMessage="No hay FSRs disponibles"
              disabled={fsrCandidates.length === 0}
            />
            <p className="text-xs text-muted-foreground">
              Se les habilita en la incidencia. Asignarlos a una asignación
              también los habilita, así que esto es un atajo, no un requisito.
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
