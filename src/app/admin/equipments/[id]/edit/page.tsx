import { EquipmentForm } from "@/components/equipments/equipment-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getEquipmentById } from "@/lib/actions/equipments"
import { notFound } from "next/navigation"

interface EditEquipmentPageProps {
  params: Promise<{ id: string }>
}

export default async function EditEquipmentPage({ params }: EditEquipmentPageProps) {
  const { id } = await params

  try {
    const equipment = await getEquipmentById(parseInt(id))

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/equipments">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Equipo</h1>
            <p className="text-muted-foreground">Actualiza la información del equipo</p>
          </div>
        </div>

        <EquipmentForm mode="edit" equipment={equipment} />
      </div>
    )
  } catch (error) {
    notFound()
  }
}
