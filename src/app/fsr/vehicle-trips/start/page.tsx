import { TripStartForm } from "@/components/vehicle-trips/trip-start-form";

export default function StartTripPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Start Trip</h1>
        <p className="text-muted-foreground">
          Record your starting odometer reading
        </p>
      </div>

      <TripStartForm />
    </div>
  );
}
