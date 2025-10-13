import { getWorkOrderFormOptions } from "@/lib/actions/work-orders";
import { WorkOrderForm } from "@/components/admin/work-orders/work-order-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewWorkOrderPage() {
  const { incidents, users } = await getWorkOrderFormOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/work-orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nueva Orden de Trabajo</h1>
          <p className="text-muted-foreground">
            Crear una nueva orden de trabajo
          </p>
        </div>
      </div>

      <WorkOrderForm incidents={incidents} users={users} />
    </div>
  );
}
