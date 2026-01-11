import { VehicleForm } from "@/components/vehicles/vehicle-form";

export default function NewVehiclePage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Vehicle</h1>
        <p className="text-muted-foreground">
          Add a new vehicle to the company fleet
        </p>
      </div>

      <VehicleForm mode="create" />
    </div>
  );
}
