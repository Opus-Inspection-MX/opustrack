import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleStatusBadge } from "@/components/vehicles/vehicle-status-badge";
import { getVehicleById } from "@/lib/actions/vehicles";

export default async function VehicleDetailPage({
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
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {vehicle.licensePlate}
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto flex-shrink-0">
          <Link href={`/admin/vehicles/${id}/edit`}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Vehicle
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Make</div>
              <div className="font-medium">{vehicle.make}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Model</div>
              <div className="font-medium">{vehicle.model}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Year</div>
              <div className="font-medium">{vehicle.year}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">License Plate</div>
              <div className="font-medium">{vehicle.licensePlate}</div>
            </div>
            {vehicle.vin && (
              <div>
                <div className="text-sm text-muted-foreground">VIN</div>
                <div className="font-medium">{vehicle.vin}</div>
              </div>
            )}
            {vehicle.color && (
              <div>
                <div className="text-sm text-muted-foreground">Color</div>
                <div className="font-medium">{vehicle.color}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <VehicleStatusBadge status={vehicle.status} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Total Trips</div>
              <div className="text-2xl font-bold">
                {vehicle._count?.trips || 0}
              </div>
            </div>
            {vehicle.notes && (
              <div>
                <div className="text-sm text-muted-foreground">Notes</div>
                <div className="text-sm">{vehicle.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
