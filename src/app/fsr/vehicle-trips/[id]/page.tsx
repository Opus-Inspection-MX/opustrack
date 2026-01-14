import { Calendar, Car, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OdometerPhotoPreview } from "@/components/vehicle-trips/odometer-photo-preview";
import { getVehicleTripById } from "@/lib/actions/vehicle-trips";

interface VehicleTrip {
  id: string;
  status: string;
  startOdometer: number;
  endOdometer?: number | null;
  startLocation?: string | null;
  endLocation?: string | null;
  startPhoto?: string | null;
  endPhoto?: string | null;
  notes?: string | null;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  vehicle?: {
    make: string;
    model: string;
    licensePlate: string;
  } | null;
  user?: {
    name: string;
  } | null;
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let trip: VehicleTrip | null = null;
  try {
    trip = (await getVehicleTripById(id)) as VehicleTrip;
  } catch (_error) {
    notFound();
  }

  if (!trip) {
    notFound();
  }

  const isInProgress = trip.status === "IN_PROGRESS";

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            Trip Details
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground truncate">
            {trip.vehicle.make} {trip.vehicle.model} -{" "}
            {trip.vehicle.licensePlate}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
          {isInProgress ? (
            <>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={`/fsr/vehicle-trips/${id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <Link href={`/fsr/vehicle-trips/${id}/end`}>End Trip</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={`/fsr/vehicle-trips/${id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
              <Badge
                variant="default"
                className="text-base px-4 py-2 w-full sm:w-auto justify-center"
              >
                Completed
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Trip Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Trip Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge variant={isInProgress ? "secondary" : "default"}>
                {isInProgress ? "In Progress" : "Completed"}
              </Badge>
            </div>

            {trip.workOrder && (
              <div>
                <div className="text-sm text-muted-foreground">Work Order</div>
                <div className="font-medium">
                  {trip.workOrder.folio ? `#${trip.workOrder.folio}` : "N/A"} -{" "}
                  {trip.workOrder.incident.title}
                </div>
              </div>
            )}

            {!isInProgress && trip.kmDriven !== null && (
              <div>
                <div className="text-sm text-muted-foreground">
                  Kilometers Driven
                </div>
                <div className="text-3xl font-bold text-primary">
                  {trip.kmDriven} km
                </div>
              </div>
            )}
          </div>

          {trip.notes && (
            <div>
              <div className="text-sm text-muted-foreground">Notes</div>
              <div className="text-sm">{trip.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Start Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Started At</div>
              <div className="font-medium text-sm sm:text-base">
                {new Date(trip.startedAt).toLocaleString("es-MX", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </div>
            </div>

            {trip.startLatitude && trip.startLongitude && (
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Start Location
                </div>
                <div className="font-mono text-xs sm:text-sm break-all">
                  {trip.startLatitude.toFixed(6)},{" "}
                  {trip.startLongitude.toFixed(6)}
                </div>
                {trip.startAddress && (
                  <div className="text-sm text-muted-foreground mt-1 break-words">
                    {trip.startAddress}
                  </div>
                )}
              </div>
            )}
          </div>

          <OdometerPhotoPreview
            photoUrl={trip.startPhotoUrl}
            provider={trip.startPhotoProvider as "vercel-blob" | "filesystem"}
            label="Start Odometer"
            odometer={trip.startOdometer}
          />
        </CardContent>
      </Card>

      {/* End Information (only if completed) */}
      {!isInProgress && trip.endOdometer && trip.endPhotoUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              End Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Ended At</div>
                <div className="font-medium text-sm sm:text-base">
                  {trip.endedAt &&
                    new Date(trip.endedAt).toLocaleString("es-MX", {
                      dateStyle: "full",
                      timeStyle: "short",
                    })}
                </div>
              </div>

              {trip.endLatitude && trip.endLongitude && (
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    End Location
                  </div>
                  <div className="font-mono text-xs sm:text-sm break-all">
                    {trip.endLatitude.toFixed(6)},{" "}
                    {trip.endLongitude.toFixed(6)}
                  </div>
                  {trip.endAddress && (
                    <div className="text-sm text-muted-foreground mt-1 break-words">
                      {trip.endAddress}
                    </div>
                  )}
                </div>
              )}
            </div>

            <OdometerPhotoPreview
              photoUrl={trip.endPhotoUrl}
              provider={
                (trip.endPhotoProvider as "vercel-blob" | "filesystem") ||
                "vercel-blob"
              }
              label="End Odometer"
              odometer={trip.endOdometer}
            />
          </CardContent>
        </Card>
      )}

      {/* FSR Information */}
      <Card>
        <CardHeader>
          <CardTitle>Driver Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <div className="text-sm text-muted-foreground">Driver</div>
            <div className="font-medium">{trip.fsr.name}</div>
            <div className="text-sm text-muted-foreground">
              {trip.fsr.email}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link href="/fsr/vehicle-trips">Back to Trips</Link>
        </Button>
      </div>
    </div>
  );
}
