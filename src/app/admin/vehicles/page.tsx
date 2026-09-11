"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { TableSkeleton } from "@/components/common/skeletons";
import { Button } from "@/components/ui/button";
import { VehicleTable } from "@/components/vehicles/vehicle-table";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { deleteVehicle, getVehicles } from "@/lib/actions/vehicles";
import { logger } from "@/lib/observability/logger";

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
      logger.error("Error loading vehicles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleDelete = async (id: string) => {
    try {
      const result = await deleteVehicle(id);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      loadVehicles();
    } catch (error) {
      logger.error("deleteVehicle failed:", error);
      toast.error("Error al eliminar el vehículo");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Vehículos"
        description="Gestionar flota vehicular de la empresa"
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/vehicles/new">
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Agregar Vehículo
            </Link>
          </Button>
        }
      />

      <SectionCard title="Todos los Vehículos">
        {loading ? (
          <TableSkeleton rows={4} />
        ) : (
          <VehicleTable vehicles={vehicles} onDelete={handleDelete} />
        )}
      </SectionCard>
    </PageContainer>
  );
}
