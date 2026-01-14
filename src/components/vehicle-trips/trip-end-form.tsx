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
import { endVehicleTrip } from "@/lib/actions/vehicle-trips";
import { fileToBase64, normalizeMimeType } from "@/lib/upload";
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
  workOrder?: {
    folio: string | null;
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
      setError("Please enter a valid odometer reading");
      return;
    }

    if (endOdometer < trip.startOdometer) {
      setError("End odometer reading cannot be less than start reading");
      return;
    }

    if (!photo) {
      setError("Please capture a photo of the odometer");
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert photo to base64
      const photoBase64 = await fileToBase64(photo);
      const photoMimetype = normalizeMimeType(photo);

      // End trip
      await endVehicleTrip(trip.id, {
        endOdometer,
        endPhotoFilename: photo.name,
        endPhotoBase64: photoBase64,
        endPhotoMimetype: photoMimetype,
        endLatitude: formData.latitude,
        endLongitude: formData.longitude,
        endAddress: formData.address || undefined,
        notes: formData.notes || undefined,
      });

      router.push("/fsr/vehicle-trips");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end trip");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>End Trip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <FormError message={error} />}

          {/* Trip Info */}
          <Card className="bg-muted">
            <CardContent className="pt-6 space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Vehicle</div>
                <div className="font-medium">
                  {trip.vehicle.make} {trip.vehicle.model} -{" "}
                  {trip.vehicle.licensePlate}
                </div>
              </div>

              {trip.workOrder && (
                <div>
                  <div className="text-sm text-muted-foreground">
                    Work Order
                  </div>
                  <div className="font-medium">
                    {trip.workOrder.folio ? `#${trip.workOrder.folio}` : "N/A"}{" "}
                    - {trip.workOrder.incident.title}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm text-muted-foreground">Started At</div>
                <div className="font-medium">
                  {new Date(trip.startedAt).toLocaleString("es-MX")}
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">
                  Starting Odometer
                </div>
                <div className="font-medium">{trip.startOdometer} km</div>
              </div>
            </CardContent>
          </Card>

          <div>
            <Label htmlFor="endOdometer">Ending Odometer (km) *</Label>
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
                  Kilometers driven:
                </span>
                <Badge variant="secondary" className="text-base w-fit">
                  {kmDriven} km
                </Badge>
              </div>
            )}
          </div>

          <div>
            <Label>Odometer Photo *</Label>
            <FileUpload
              onFilesSelected={(files) => setPhoto(files[0] || null)}
              maxFiles={1}
              maxSizeMB={10}
              label="Capture odometer reading"
              showCamera={true}
              accept="image/*"
            />
          </div>

          <GPSLocationCapture
            onLocationCapture={handleLocationCapture}
            label="Ending Location (Optional)"
            showAddressField={true}
          />

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any issues, observations, or additional notes"
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
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {isSubmitting ? "Ending Trip..." : "End Trip"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
