import { getWorkOrderById, getWorkOrderFormOptions } from "@/lib/actions/work-orders";
import { WorkOrderForm } from "@/components/admin/work-orders/work-order-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export default async function EditWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [workOrder, { incidents, users }] = await Promise.all([
    getWorkOrderById(id),
    getWorkOrderFormOptions(),
  ]);

  if (!workOrder) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/work-orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Orden de Trabajo</h1>
          <p className="text-muted-foreground">
            Actualizar orden de trabajo
          </p>
        </div>
      </div>

      <WorkOrderForm
        workOrder={workOrder}
        incidents={incidents}
        users={users}
      />
    </div>
  );
}
