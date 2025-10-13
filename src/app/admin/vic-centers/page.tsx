import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getVICs } from "@/lib/actions/vics";
import { VICsTable } from "@/components/admin/vics/vics-table";

export default async function VICCentersPage() {
  const vics = await getVICs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Centros de Verificación</h1>
          <p className="text-muted-foreground">
            Administre los centros de verificación vehicular
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/vic-centers/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar VIC
          </Link>
        </Button>
      </div>

      <VICsTable vics={vics} />
    </div>
  );
}
