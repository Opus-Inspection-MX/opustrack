import { notFound } from "next/navigation";
import { BackButton } from "@/components/common/back-button";
import { EquipmentForm } from "@/components/equipments/equipment-form";
import { getEquipmentById } from "@/lib/actions/equipments";

interface EditEquipmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEquipmentPage({
  params,
}: EditEquipmentPageProps) {
  const { id } = await params;

  try {
    const equipment = await getEquipmentById(parseInt(id, 10));

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton fallback="/admin/equipments" />
          <div>
            <h1 className="text-3xl font-bold">Editar Equipo</h1>
            <p className="text-muted-foreground">
              Actualiza la información del equipo
            </p>
          </div>
        </div>

        <EquipmentForm mode="edit" equipment={equipment} />
      </div>
    );
  } catch (_error) {
    notFound();
  }
}
