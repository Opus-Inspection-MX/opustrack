import { notFound } from "next/navigation";
import { TripEndForm } from "@/components/vehicle-trips/trip-end-form";
import { getVehicleTripById } from "@/lib/actions/vehicle-trips";

interface VehicleTrip {
  id: string;
  status: string;
  startOdometer: number;
  endOdometer?: number | null;
  vehicleId: string;
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

  if (trip.status !== "IN_PROGRESS") {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">End Trip</h1>
          <p className="text-destructive">
            This trip is already completed or cancelled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">End Trip</h1>
        <p className="text-muted-foreground">
          Record your ending odometer reading
        </p>
      </div>

      <TripEndForm trip={trip} />
    </div>
  );
}
