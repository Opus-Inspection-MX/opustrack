"use client";

import { Car, Plus } from "lucide-react";
import moment from "moment-timezone";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { FilterBar } from "@/components/common/filter-bar";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { TableSkeleton } from "@/components/common/skeletons";
import { StatusBadge } from "@/components/common/status-badge";
import { DateRangeFilter } from "@/components/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyVehicleTrips } from "@/lib/actions/vehicle-trips";
import { logger } from "@/lib/observability/logger";
import { APP_TZ, formatMX } from "@/lib/utils/datetime";

interface VehicleTrip {
  id: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    licensePlate: string;
  };
  assignment?: {
    id: string;
    folio: number;
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
    moment().tz(APP_TZ).startOf("isoWeek").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(() =>
    moment().tz(APP_TZ).endOf("isoWeek").format("YYYY-MM-DD"),
  );

  const loadTrips = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const data = await getMyVehicleTrips({ startDate: start, endDate: end });
      setTrips(data);
    } catch (error) {
      logger.error("Error loading trips:", error);
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
    <PageContainer>
      <PageHeader
        title="Viajes de Vehículo"
        description="Registro de kilómetros recorridos"
        actions={
          <Button asChild className="min-h-[44px] w-full sm:w-auto">
            <Link href="/fsr/vehicle-trips/start">
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Iniciar Viaje
            </Link>
          </Button>
        }
      />

      <FilterBar
        activeCount={0}
        onClear={() =>
          handleDateChange(
            moment().tz(APP_TZ).startOf("isoWeek").format("YYYY-MM-DD"),
            moment().tz(APP_TZ).endOf("isoWeek").format("YYYY-MM-DD"),
          )
        }
      >
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
        />
      </FilterBar>

      <SectionCard title="Mis Viajes">
        {loading ? (
          <TableSkeleton rows={4} />
        ) : trips.length === 0 ? (
          <EmptyState
            icon={Car}
            title="Sin viajes"
            description="No se encontraron viajes en este rango de fechas."
            action={{
              label: "Iniciar Viaje",
              href: "/fsr/vehicle-trips/start",
            }}
          />
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
                            {formatMX(trip.startedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end gap-2">
                        {!trip.endedAt ? (
                          <StatusBadge tone="progress">En Progreso</StatusBadge>
                        ) : (
                          <>
                            <div className="text-xl sm:text-2xl font-bold">
                              {trip.kmDriven} km
                            </div>
                            <StatusBadge tone="done">Completado</StatusBadge>
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
      </SectionCard>
    </PageContainer>
  );
}
