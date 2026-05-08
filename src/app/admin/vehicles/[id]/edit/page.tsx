import { notFound } from "next/navigation";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import {
  getFsrUsersForAssignment,
  getVehicleById,
  getVehicleStatuses,
} from "@/lib/actions/vehicles";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string | null;
  color?: string | null;
  status: { id: number; name: string };
  assignedFsrId?: string | null;
  assignedFsr?: { id: string; name: string; email: string } | null;
}

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let vehicle: Vehicle | null = null;
  try {
    vehicle = (await getVehicleById(id)) as Vehicle;
  } catch {
    notFound();
  }

  if (!vehicle) {
    notFound();
  }

  const [fsrUsers, statuses] = await Promise.all([
    getFsrUsersForAssignment(),
    getVehicleStatuses(),
  ]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Editar Vehículo</h1>
        <p className="text-muted-foreground">Update vehicle information</p>
      </div>

      <VehicleForm
        mode="edit"
        vehicle={vehicle}
        fsrUsers={fsrUsers}
        statuses={statuses}
      />
    </div>
  );
}
