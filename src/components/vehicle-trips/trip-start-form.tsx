"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
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
import {
  getAvailableVehicles,
  getMyWorkOrdersForTrips,
  startVehicleTrip,
} from "@/lib/actions/vehicle-trips";
import { fileToBase64, normalizeMimeType } from "@/lib/upload";
import { GPSLocationCapture } from "./gps-location-capture";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  licensePlate: string;
}

interface WorkOrder {
  id: string;
  folio: string | null;
  incident: {
    id: number;
    title: string;
  };
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export function TripStartForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    vehicleId: "",
    workOrderId: "",
    startOdometer: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    address: "",
    notes: "",
  });

  const [photo, setPhoto] = useState<File | null>(null);

  const loadFormData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [vehiclesData, workOrdersData] = await Promise.all([
        getAvailableVehicles(),
        getMyWorkOrdersForTrips(),
      ]);
      setVehicles(vehiclesData);
      setWorkOrders(workOrdersData);
    } catch (err) {
      setError("Error al cargar los datos del formulario");
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  }, []);

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

    // Validation
    if (!formData.vehicleId) {
      setError("Por favor selecciona un vehículo");
      return;
    }

    if (
      !formData.startOdometer ||
      Number.parseInt(formData.startOdometer, 10) <= 0
    ) {
      setError("Por favor ingresa una lectura de odómetro válida");
      return;
    }

    if (!photo) {
      setError("Por favor toma una foto del odómetro");
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert photo to base64
      const photoBase64 = await fileToBase64(photo);
      const photoMimetype = normalizeMimeType(photo);

      // Start trip
      await startVehicleTrip({
        vehicleId: formData.vehicleId,
        workOrderId: formData.workOrderId || null,
        startOdometer: Number.parseInt(formData.startOdometer, 10),
        startPhotoFilename: photo.name,
        startPhotoBase64: photoBase64,
        startPhotoMimetype: photoMimetype,
        startLatitude: formData.latitude,
        startLongitude: formData.longitude,
        startAddress: formData.address || undefined,
        notes: formData.notes || undefined,
      });

      router.push("/fsr/vehicle-trips");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar el viaje");
    } finally {
      setIsSubmitting(false);
    }
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
            <Label htmlFor="workOrder">Orden de Trabajo (Opcional)</Label>
            <Select
              value={formData.workOrderId || "none"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  workOrderId: value === "none" ? "" : value,
                })
              }
            >
              <SelectTrigger id="workOrder">
                <SelectValue placeholder="Ninguna - Viaje personal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguna - Viaje personal</SelectItem>
                {workOrders.map((wo) => (
                  <SelectItem key={wo.id} value={wo.id}>
                    {wo.folio ? `#${wo.folio}` : `WO-${wo.id}`} -{" "}
                    {wo.incident.title}
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
              {isSubmitting ? "Iniciando Viaje..." : "Iniciar Viaje"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
