import { Pencil, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleStatusBadge } from "@/components/vehicles/vehicle-status-badge";
import { getVehicleById } from "@/lib/actions/vehicles";

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
  notes?: string | null;
  _count?: {
    trips: number;
  };
}

export default async function VehicleDetailPage({
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
            Editar Vehículo
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
              <div className="text-sm text-muted-foreground">Marca</div>
              <div className="font-medium">{vehicle.make}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Modelo</div>
              <div className="font-medium">{vehicle.model}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Año</div>
              <div className="font-medium">{vehicle.year}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Placa</div>
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
              <div className="text-sm text-muted-foreground">Estado</div>
              <VehicleStatusBadge status={vehicle.status} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment & Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">FSR Asignado</div>
              {vehicle.assignedFsr ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {vehicle.assignedFsr.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {vehicle.assignedFsr.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground italic">
                  Sin FSR asignado
                </div>
              )}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">
                Viajes Totales
              </div>
              <div className="text-2xl font-bold">
                {vehicle._count?.trips || 0}
              </div>
            </div>
            {vehicle.notes && (
              <div>
                <div className="text-sm text-muted-foreground">Notas</div>
                <div className="text-sm">{vehicle.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
