"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyVehicleTrips } from "@/lib/actions/vehicle-trips";

interface VehicleTrip {
  id: string;
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
  };
  startOdometer: number;
  endOdometer: number | null;
  kmDriven: number | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
}

export default function VehicleTripsPage() {
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyVehicleTrips();
      setTrips(data);
    } catch (error) {
      console.error("Error loading trips:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Vehicle Trips</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Track kilometers driven
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/fsr/vehicle-trips/start">
            <Plus className="h-4 w-4 mr-2" />
            Start Trip
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Trips</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading trips...
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No trips found. Start your first trip to track kilometers.
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <Link
                  key={trip.id}
                  href={
                    trip.status === "IN_PROGRESS"
                      ? `/fsr/vehicle-trips/${trip.id}/end`
                      : `/fsr/vehicle-trips/${trip.id}`
                  }
                  className="block"
                >
                  <Card className="hover:bg-accent transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <Car className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold truncate">
                              {trip.vehicle.make} {trip.vehicle.model}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {trip.vehicle.licensePlate}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(trip.startedAt).toLocaleString("es-MX")}
                            </div>
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-2">
                          {trip.status === "IN_PROGRESS" ? (
                            <Badge
                              variant="secondary"
                              className="whitespace-nowrap"
                            >
                              In Progress
                            </Badge>
                          ) : (
                            <>
                              <div className="text-xl sm:text-2xl font-bold">
                                {trip.kmDriven} km
                              </div>
                              <Badge className="whitespace-nowrap">
                                Completed
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
