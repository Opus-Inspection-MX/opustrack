import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EquipmentForm } from "@/components/equipments/equipment-form";
import { Button } from "@/components/ui/button";

export default function NewEquipmentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/equipments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Equipo</h1>
          <p className="text-muted-foreground">
            Crea un nuevo equipo para una línea
          </p>
        </div>
      </div>

      <EquipmentForm mode="create" />
    </div>
  );
}
