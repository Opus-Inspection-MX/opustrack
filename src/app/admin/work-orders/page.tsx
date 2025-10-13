import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getWorkOrders } from "@/lib/actions/work-orders";
import { WorkOrdersTable } from "@/components/admin/work-orders/work-orders-table";

export default async function WorkOrdersPage() {
  const workOrders = await getWorkOrders();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ordenes de Trabajo</h1>
          <p className="text-muted-foreground">
            Administre las ordenes de trabajo del sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/work-orders/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Orden
          </Link>
        </Button>
      </div>

      <WorkOrdersTable workOrders={workOrders} />
    </div>
  );
}
