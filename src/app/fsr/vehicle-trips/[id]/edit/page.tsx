"use client";

import { isFailure } from "@/lib/actions/result";
import { useRouter } from "next/navigation";
import { type FormEvent, use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getVehicleTripById,
  updateVehicleTrip,
} from "@/lib/actions/vehicle-trips";

interface Trip {
  id: string;
  notes: string | null;
  startAddress: string | null;
  endAddress: string | null;
  status: string;
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
  };
}

export default function EditTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    notes: "",
    startAddress: "",
    endAddress: "",
  });

  useEffect(() => {
    const loadTrip = async () => {
      try {
        const tripData = await getVehicleTripById(resolvedParams.id);
        setTrip(tripData as unknown as Trip);
        setFormData({
          notes: tripData.notes || "",
          startAddress: tripData.startAddress || "",
          endAddress: tripData.endAddress || "",
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error al cargar los datos del viaje",
        );
      } finally {
        setLoading(false);
      }
    };

    loadTrip();
  }, [resolvedParams.id]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await updateVehicleTrip(resolvedParams.id, {
        notes: formData.notes || undefined,
        startAddress: formData.startAddress || undefined,
        endAddress: formData.endAddress || undefined,
      });

      if (isFailure(result)) {
        setError(result.error);
        return;
      }

      router.push(`/fsr/vehicle-trips/${resolvedParams.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar el viaje",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Cargando datos del viaje...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Viaje no encontrado</p>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="mt-4"
            >
              Regresar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Editar Viaje</h1>
          <p className="text-sm sm:text-base text-muted-foreground truncate">
            {trip.vehicle.make} {trip.vehicle.model} -{" "}
            {trip.vehicle.licensePlate}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actualizar Información del Viaje</CardTitle>
          <p className="text-sm text-muted-foreground">
            Puedes actualizar notas y direcciones. Las lecturas del odómetro y
            las fotos no pueden modificarse.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <FormError message={error} />}

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Propósito, destino, observaciones, etc."
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="startAddress">Dirección de Inicio</Label>
              <Input
                id="startAddress"
                value={formData.startAddress}
                onChange={(e) =>
                  setFormData({ ...formData, startAddress: e.target.value })
                }
                placeholder="Ej. Cliente ABC, Calle XYZ 123"
              />
            </div>

            {trip.status === "COMPLETED" && (
              <div>
                <Label htmlFor="endAddress">Dirección de Fin</Label>
                <Input
                  id="endAddress"
                  value={formData.endAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, endAddress: e.target.value })
                  }
                  placeholder="Ej. Oficina, Cliente XYZ"
                />
              </div>
            )}

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
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
