import { ArrowLeft, Edit, List, Wrench } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLineById } from "@/lib/actions/lines";
import { formatMX } from "@/lib/utils/datetime";

interface LineDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LineDetailPage({ params }: LineDetailPageProps) {
  const { id } = await params;

  try {
    const line = await getLineById(parseInt(id, 10));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/lines">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{line.name}</h1>
              <p className="text-muted-foreground">Detalles de la línea</p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/admin/lines/${id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>
        </div>

        {/* Line Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <List className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="font-medium">{line.name}</p>
              </div>
            </div>

            {line.description && (
              <div className="flex items-start gap-3">
                <List className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="font-medium">{line.description}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <List className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">
                  {line.cliente.name} ({line.cliente.code})
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <List className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge
                  className={
                    line.active
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }
                >
                  {line.active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Equipos ({line.equipments.length})
            </CardTitle>
            <CardDescription>Equipos asignados a esta línea</CardDescription>
          </CardHeader>
          <CardContent>
            {line.equipments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay equipos asignados a esta línea
              </p>
            ) : (
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {line.equipments.map((equipment) => (
                      <TableRow key={equipment.id}>
                        <TableCell className="font-medium">
                          {equipment.name}
                        </TableCell>
                        <TableCell>
                          {equipment.description || (
                            <span className="text-muted-foreground text-sm">
                              Sin descripción
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={equipment.active ? "default" : "secondary"}
                            className={
                              equipment.active
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {equipment.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatMX(equipment.createdAt, {
                            dateStyle: "short",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch (_error) {
    notFound();
  }
}
