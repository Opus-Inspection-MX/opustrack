"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PendingDrafts } from "@/components/offline/pending-drafts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import {
  getAvailableVehicles,
  getMyAssignmentsForTrips,
  startVehicleTrip,
} from "@/lib/actions/vehicle-trips";
import { logger } from "@/lib/observability/logger";
import { describeEnqueueFailure, saveDraft } from "@/lib/offline/flush";
import {
  loadEntries,
  newOutboxKey,
  OUTBOX_CHANGED_EVENT,
} from "@/lib/offline/outbox";
import { normalizeMimeType } from "@/lib/upload";
import { GPSLocationCapture } from "./gps-location-capture";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  licensePlate: string;
}

interface Assignment {
  id: string;
  folio: number;
  incident: {
    id: number;
    title: string;
  };
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export function TripStartForm({ canManage = false }: { canManage?: boolean }) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    vehicleId: "",
    assignmentId: "",
    startOdometer: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    address: "",
    notes: "",
    startExceptionReason: "",
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const operation = useRef<{ key: string; capturedAt: string } | null>(null);
  const [queued, setQueued] = useState(false);
  useEffect(() => {
    const refresh = () => {
      if (
        queued &&
        operation.current &&
        !loadEntries().some((entry) => entry.key === operation.current?.key)
      ) {
        operation.current = null;
        setQueued(false);
      }
    };
    window.addEventListener(OUTBOX_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(OUTBOX_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [queued]);

  const loadFormData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [vehiclesData, assignmentsData] = await Promise.all([
        getAvailableVehicles({ includeOperationalExceptions: canManage }),
        getMyAssignmentsForTrips(),
      ]);
      setVehicles(vehiclesData);
      setAssignments(assignmentsData);
    } catch (err) {
      toast.error("Error al cargar los datos del formulario");
      logger.error("Error loading trip form data:", err);
    } finally {
      setLoadingData(false);
    }
  }, [canManage]);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  const handleLocationCapture = (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => {
    setFormData({
      ...formData,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address || "",
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (queued) {
      toast.error(
        "Reintenta el borrador pendiente antes de capturar otro inicio.",
      );
      return;
    }

    // Validation
    if (!formData.vehicleId) {
      setError("Por favor selecciona un vehículo");
      return;
    }

    if (
      !formData.startOdometer ||
      Number.parseInt(formData.startOdometer, 10) < 0
    ) {
      setError("Por favor ingresa una lectura de odómetro válida");
      return;
    }

    if (!photo) {
      setError("Por favor toma una foto del odómetro");
      return;
    }

    setIsSubmitting(true);
    operation.current ??= {
      key: newOutboxKey(),
      capturedAt: new Date().toISOString(),
    };

    // Fully offline: freeze the field evidence as a draft without calling.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueStartDraft();
      setIsSubmitting(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append("idempotencyKey", operation.current.key);
      fd.append("capturedAt", operation.current.capturedAt);
      fd.append("vehicleId", formData.vehicleId);
      if (formData.assignmentId)
        fd.append("assignmentId", formData.assignmentId);
      fd.append("startOdometer", formData.startOdometer);
      fd.append("photo", photo);
      fd.append("photoMimetype", normalizeMimeType(photo));
      if (formData.latitude !== undefined)
        fd.append("startLatitude", String(formData.latitude));
      if (formData.longitude !== undefined)
        fd.append("startLongitude", String(formData.longitude));
      if (formData.address) fd.append("startAddress", formData.address);
      if (formData.notes) fd.append("notes", formData.notes);
      if (formData.startExceptionReason)
        fd.append("startExceptionReason", formData.startExceptionReason);

      const result = await startVehicleTrip(fd);

      if (isFailure(result)) {
        operation.current = null;
        toast.error(result.error);
        return;
      }

      router.push("/fsr/vehicle-trips");
    } catch (err) {
      // Transport failure: the odometer photo stages as a local blob (never
      // base64) and the frozen scalars + GPS flush on reconnect.
      queueStartDraft(err instanceof Error ? err.message : undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const queueStartDraft = (cause?: string) => {
    if (!photo) return;
    const fields: Record<string, string> = {
      vehicleId: formData.vehicleId,
      startOdometer: formData.startOdometer,
      photoMimetype: normalizeMimeType(photo),
    };
    if (formData.assignmentId) fields.assignmentId = formData.assignmentId;
    if (formData.latitude !== undefined)
      fields.startLatitude = String(formData.latitude);
    if (formData.longitude !== undefined)
      fields.startLongitude = String(formData.longitude);
    if (formData.address) fields.startAddress = formData.address;
    if (formData.notes) fields.notes = formData.notes;
    if (formData.startExceptionReason)
      fields.startExceptionReason = formData.startExceptionReason;
    const queued = saveDraft({
      kind: "startVehicleTrip",
      fields,
      photo,
      userId: currentUserId,
      identity: operation.current ?? undefined,
    });
    if (!queued.queued) {
      toast.error(describeEnqueueFailure(queued.reason));
      return;
    }
    setQueued(true);
    toast.success(
      `Sin conexión. Inicio de viaje guardado como borrador.${cause ? ` (${cause})` : ""}`,
    );
  };

  if (loadingData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Cargando formulario...
        </CardContent>
      </Card>
    );
  }

  if (vehicles.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">
            No hay vehículos disponibles. Todos los vehículos están en uso.
          </p>
          <Button onClick={() => router.back()} variant="outline">
            Regresar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PendingDrafts
        kinds={["startVehicleTrip"]}
        currentUserId={currentUserId}
        onFlushed={() => router.push("/fsr/vehicle-trips")}
      />
      <Card>
        <CardHeader>
          <CardTitle>Iniciar Viaje</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <FormError message={error} />}

            <div>
              <Label htmlFor="vehicle">Vehículo *</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) =>
                  setFormData({ ...formData, vehicleId: value })
                }
              >
                <SelectTrigger id="vehicle">
                  <SelectValue placeholder="Selecciona un vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} - {vehicle.licensePlate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assignment">Asignación (Opcional)</Label>
              <Select
                value={formData.assignmentId || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    assignmentId: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger id="assignment">
                  <SelectValue placeholder="Ninguna - Viaje personal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna - Viaje personal</SelectItem>
                  {assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      AS-{a.folio} - {a.incident.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startOdometer">Odómetro Inicial (km) *</Label>
              <Input
                id="startOdometer"
                type="number"
                inputMode="numeric"
                value={formData.startOdometer}
                onChange={(e) =>
                  setFormData({ ...formData, startOdometer: e.target.value })
                }
                placeholder="Ej. 12345"
                min={0}
                required
              />
            </div>

            <div>
              <Label>Foto del Odómetro *</Label>
              <FileUpload
                onFilesSelected={(files) => setPhoto(files[0] || null)}
                maxFiles={1}
                maxSizeMB={10}
                label="Captura la lectura del odómetro"
                showCamera={true}
                accept="image/*"
              />
            </div>

            <GPSLocationCapture
              onLocationCapture={handleLocationCapture}
              label="Ubicación de Inicio (Opcional)"
              showAddressField={true}
            />

            <div>
              <Label htmlFor="notes">Notas (Opcional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Propósito del viaje, destino, etc."
                rows={3}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              {canManage && (
                <div className="w-full">
                  <Label htmlFor="trip-exception">
                    Motivo de excepción operacional
                  </Label>
                  <Textarea
                    id="trip-exception"
                    value={formData.startExceptionReason}
                    maxLength={1000}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        startExceptionReason: event.target.value,
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Requerido para iniciar en un día de ausencia, festivo o con
                    vehículo fuera de servicio.
                  </p>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || queued}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {isSubmitting ? "Iniciando Viaje..." : "Iniciar Viaje"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
