import { getVICs } from "@/lib/actions/vics";
import { PartForm } from "@/components/admin/parts/part-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewPartPage() {
  const vics = await getVICs();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/parts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nueva Parte</h1>
          <p className="text-muted-foreground">
            Agregar una nueva parte al inventario
          </p>
        </div>
      </div>

      <PartForm vics={vics} />
    </div>
  );
}
