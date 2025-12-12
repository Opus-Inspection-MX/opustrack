import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit, Wrench, List } from "lucide-react"
import Link from "next/link"
import { getEquipmentById } from "@/lib/actions/equipments"
import { notFound } from "next/navigation"

interface EquipmentDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function EquipmentDetailPage({ params }: EquipmentDetailPageProps) {
  const { id } = await params

  try {
    const equipment = await getEquipmentById(parseInt(id))

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/equipments">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{equipment.name}</h1>
              <p className="text-muted-foreground">Detalles del equipo</p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/admin/equipments/${id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>
        </div>

        {/* Equipment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="font-medium">{equipment.name}</p>
              </div>
            </div>

            {equipment.description && (
              <div className="flex items-start gap-3">
                <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">{equipment.description}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <List className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Línea</p>
                <p className="font-medium">
                  <Link
                    href={`/admin/lines/${equipment.line.id}`}
                    className="text-primary hover:underline"
                  >
                    {equipment.line.name}
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">CVV</p>
                <p className="font-medium">
                  {equipment.line.vic.name} ({equipment.line.vic.code})
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={equipment.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {equipment.active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Creado</p>
                <p className="font-medium">
                  {new Date(equipment.createdAt).toLocaleDateString()} {new Date(equipment.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    notFound()
  }
}
