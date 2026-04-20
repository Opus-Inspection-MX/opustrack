import { notFound } from "next/navigation";
import { TripEndForm } from "@/components/vehicle-trips/trip-end-form";
import { getVehicleTripById } from "@/lib/actions/vehicle-trips";

interface VehicleTrip {
  id: string;
  startOdometer: number;
  endOdometer?: number | null;
  startedAt: string;
  endedAt?: string | null;
  vehicleId: string;
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
  };
  workOrder?: {
    folio: string | null;
    incident: { title: string };
  } | null;
}

export default async function EndTripPage({
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

  if (trip.endedAt) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Finalizar Viaje</h1>
          <p className="text-destructive">
            Este viaje ya fue completado o cancelado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finalizar Viaje</h1>
        <p className="text-muted-foreground">
          Registra la lectura final del odómetro
        </p>
      </div>

      <TripEndForm trip={trip} />
    </div>
  );
}
