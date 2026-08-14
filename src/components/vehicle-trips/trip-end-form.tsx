"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { endVehicleTrip } from "@/lib/actions/vehicle-trips";
import { normalizeMimeType } from "@/lib/upload";
import { formatMX } from "@/lib/utils/datetime";
import { GPSLocationCapture } from "./gps-location-capture";

interface Trip {
  id: string;
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
  };
  startOdometer: number;
  startedAt: string;
  assignment?: {
    folio: number;
    incident: {
      title: string;
    };
  } | null;
}

interface TripEndFormProps {
  trip: Trip;
}

export function TripEndForm({ trip }: TripEndFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    endOdometer: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    address: "",
    notes: "",
  });

  const [photo, setPhoto] = useState<File | null>(null);

  const kmDriven =
    formData.endOdometer &&
    Number.parseInt(formData.endOdometer, 10) > trip.startOdometer
      ? Number.parseInt(formData.endOdometer, 10) - trip.startOdometer
      : 0;

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

    // Validation
    const endOdometer = Number.parseInt(formData.endOdometer, 10);
    if (!formData.endOdometer || endOdometer <= 0) {
      setError("Por favor ingresa una lectura de odómetro válida");
      return;
    }

    if (endOdometer < trip.startOdometer) {
      setError("La lectura final no puede ser menor a la inicial");
      return;
    }

    if (!photo) {
      setError("Por favor toma una foto del odómetro");
      return;
    }

    setIsSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("tripId", trip.id);
      fd.append("endOdometer", String(endOdometer));
      fd.append("photo", photo);
      fd.append("photoMimetype", normalizeMimeType(photo));
      if (formData.latitude !== undefined)
        fd.append("endLatitude", String(formData.latitude));
      if (formData.longitude !== undefined)
        fd.append("endLongitude", String(formData.longitude));
      if (formData.address) fd.append("endAddress", formData.address);
      if (formData.notes) fd.append("notes", formData.notes);

      const result = await endVehicleTrip(fd);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }

      router.push("/fsr/vehicle-trips");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al finalizar el viaje",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finalizar Viaje</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <FormError message={error} />}

          {/* Trip Info */}
          <Card className="bg-muted">
            <CardContent className="pt-6 space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Vehículo</div>
                <div className="font-medium">
                  {trip.vehicle.make} {trip.vehicle.model} -{" "}
                  {trip.vehicle.licensePlate}
                </div>
              </div>

              {trip.assignment && (
                <div>
                  <div className="text-sm text-muted-foreground">
                    Asignación
                  </div>
                  <div className="font-medium">
                    AS-{trip.assignment.folio} -{" "}
                    {trip.assignment.incident.title}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm text-muted-foreground">Inicio</div>
                <div className="font-medium">{formatMX(trip.startedAt)}</div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">
                  Odómetro Inicial
                </div>
                <div className="font-medium">{trip.startOdometer} km</div>
              </div>
            </CardContent>
          </Card>

          <div>
            <Label htmlFor="endOdometer">Odómetro Final (km) *</Label>
            <Input
              id="endOdometer"
              type="number"
              value={formData.endOdometer}
              onChange={(e) =>
                setFormData({ ...formData, endOdometer: e.target.value })
              }
              placeholder="e.g., 12450"
              min={trip.startOdometer}
              required
            />
            {kmDriven > 0 && (
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Kilómetros recorridos:
                </span>
                <Badge variant="secondary" className="text-base w-fit">
                  {kmDriven} km
                </Badge>
              </div>
            )}
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
            label="Ubicación de Fin (Opcional)"
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
              placeholder="Problemas, observaciones o notas adicionales"
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
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
              disabled={isSubmitting}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {isSubmitting ? "Finalizando Viaje..." : "Finalizar Viaje"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
