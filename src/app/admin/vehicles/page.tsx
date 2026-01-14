"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleTable } from "@/components/vehicles/vehicle-table";
import { deleteVehicle, getVehicles } from "@/lib/actions/vehicles";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string | null;
  color?: string | null;
  status: { id: number; name: string; active: boolean };
  assignedFsrId?: string | null;
  assignedFsr?: { id: string; name: string; email: string } | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    trips: number;
  };
}

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVehicles();
      setVehicles(data);
    } catch (error) {
      console.error("Error loading vehicles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vehicle?")) {
      return;
    }

    try {
      await deleteVehicle(id);
      router.refresh();
      loadVehicles();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to delete vehicle",
      );
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Vehicles</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage company vehicle fleet
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/vehicles/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vehicles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading vehicles...
            </div>
          ) : (
            <VehicleTable vehicles={vehicles} onDelete={handleDelete} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
