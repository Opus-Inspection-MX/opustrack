import { BackButton } from "@/components/common/back-button";
import { EquipmentForm } from "@/components/equipments/equipment-form";

export default function NewEquipmentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/equipments" />
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
