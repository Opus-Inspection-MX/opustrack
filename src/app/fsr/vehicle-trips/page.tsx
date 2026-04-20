"use client";

import { Car, Plus } from "lucide-react";
import moment from "moment-timezone";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DateRangeFilter } from "@/components/reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyVehicleTrips } from "@/lib/actions/vehicle-trips";

const TZ = "America/Mexico_City";

interface VehicleTrip {
  id: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    licensePlate: string;
  };
  workOrder?: {
    id: string;
    folio: string | null;
    incident: {
      id: number;
      title: string;
    };
  } | null;
  startOdometer: number;
  endOdometer: number | null;
  kmDriven: number | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function VehicleTripsPage() {
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() =>
    moment().tz(TZ).startOf("isoWeek").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(() =>
    moment().tz(TZ).endOf("isoWeek").format("YYYY-MM-DD"),
  );

  const loadTrips = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const data = await getMyVehicleTrips({ startDate: start, endDate: end });
      setTrips(data);
    } catch (error) {
      console.error("Error loading trips:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrips(startDate, endDate);
  }, [loadTrips, startDate, endDate]);

  const handleDateChange = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Viajes de Vehículo</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Registro de kilómetros recorridos
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <Button asChild className="w-full sm:w-auto">
            <Link href="/fsr/vehicle-trips/start">
              <Plus className="h-4 w-4 mr-2" />
              Iniciar Viaje
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis Viajes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando viajes...
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron viajes en este rango de fechas.
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <Link
                  key={trip.id}
                  href={
                    !trip.endedAt
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
                          {!trip.endedAt ? (
                            <Badge
                              variant="secondary"
                              className="whitespace-nowrap"
                            >
                              En Progreso
                            </Badge>
                          ) : (
                            <>
                              <div className="text-xl sm:text-2xl font-bold">
                                {trip.kmDriven} km
                              </div>
                              <Badge className="whitespace-nowrap">
                                Completado
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
