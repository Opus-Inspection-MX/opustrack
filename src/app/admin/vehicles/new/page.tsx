import { VehicleForm } from "@/components/vehicles/vehicle-form";
import {
  getFsrUsersForAssignment,
  getVehicleStatuses,
} from "@/lib/actions/vehicles";

export default async function NewVehiclePage() {
  const [fsrUsers, statuses] = await Promise.all([
    getFsrUsersForAssignment(),
    getVehicleStatuses(),
  ]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Vehicle</h1>
        <p className="text-muted-foreground">
          Add a new vehicle to the company fleet
        </p>
      </div>

      <VehicleForm mode="create" fsrUsers={fsrUsers} statuses={statuses} />
    </div>
  );
}
