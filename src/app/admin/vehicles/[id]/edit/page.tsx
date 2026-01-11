import { notFound } from "next/navigation";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { getVehicleById } from "@/lib/actions/vehicles";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let vehicle;
  try {
    vehicle = await getVehicleById(id);
  } catch (error) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Vehicle</h1>
        <p className="text-muted-foreground">Update vehicle information</p>
      </div>

      <VehicleForm mode="edit" vehicle={vehicle} />
    </div>
  );
}
