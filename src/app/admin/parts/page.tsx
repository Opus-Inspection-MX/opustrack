import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getParts } from "@/lib/actions/parts";
import { PartsTable } from "@/components/admin/parts/parts-table";

export default async function PartsPage() {
  const parts = await getParts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Partes e Inventario</h1>
          <p className="text-muted-foreground">
            Administre las partes y el inventario del sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/parts/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Parte
          </Link>
        </Button>
      </div>

      <PartsTable parts={parts} />
    </div>
  );
}
