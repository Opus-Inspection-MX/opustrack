"use client";

import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { deleteWorkPart, getWorkPartById } from "@/lib/actions/work-parts";
import { formatMX } from "@/lib/utils/datetime";

interface Part {
  id: string;
  name: string;
  price?: number | null;
  stock: number;
  description?: string | null;
}

interface AssignmentStatus {
  name: string;
}

interface AssignedUser {
  name: string;
}

interface Assignment {
  id: string;
  status?: AssignmentStatus | null;
  assignees?: Array<{ user: AssignedUser }>;
}

interface AssignmentActivity {
  id: string;
  description: string;
}

interface WorkPart {
  id: string;
  assignmentId?: string | null;
  partId: string;
  quantity: number;
  price?: number | null;
  description?: string | null;
  createdAt: Date | string;
  part?: Part | null;
  assignment?: Assignment | null;
  assignmentActivity?: AssignmentActivity | null;
}

export default function WorkPartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [workPart, setWorkPart] = useState<WorkPart | null>(null);

  useEffect(() => {
    const fetchWorkPart = async () => {
      try {
        const data = await getWorkPartById(id);
        setWorkPart(data);
      } catch (error) {
        console.error("Error fetching work part:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkPart();
  }, [id]);

  const handleDelete = async () => {
    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar esta refacción? El stock será restaurado.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const assignmentId = workPart?.assignmentId;
      const result = await deleteWorkPart(id);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      router.push(
        assignmentId
          ? `/admin/assignments/${assignmentId}`
          : "/admin/work-parts",
      );
    } catch (error) {
      console.error("Error deleting work part:", error);
      toast.error("Error al eliminar la refacción");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando refacción..." />
      </div>
    );
  }

  if (!workPart) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Refacción No Encontrada</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Detalles de Refacción</h1>
            <p className="text-muted-foreground">
              Ver información de la refacción
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/work-parts/${id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Work Part Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la Refacción</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  ID de Refacción
                </p>
                <p className="text-sm">{workPart.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Nombre de la Pieza
                </p>
                <p className="text-sm">{workPart.part?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Cantidad
                </p>
                <p className="text-sm">{workPart.quantity}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Precio (al momento de uso)
                </p>
                <p className="text-sm">
                  ${workPart.price?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Costo Total
                </p>
                <p className="text-sm font-bold">
                  $
                  {((workPart.price || 0) * (workPart.quantity || 0)).toFixed(
                    2,
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Agregado El
                </p>
                <p className="text-sm">{formatMX(workPart.createdAt)}</p>
              </div>
            </div>

            {workPart.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Descripción
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {workPart.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Part Details */}
        {workPart.part && (
          <Card>
            <CardHeader>
              <CardTitle>Detalles de la Pieza</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    ID de Pieza
                  </p>
                  <p className="text-sm">{workPart.part.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Stock Actual
                  </p>
                  <p className="text-sm">{workPart.part.stock}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Precio Actual
                  </p>
                  <p className="text-sm">
                    ${workPart.part.price?.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>
              {workPart.part.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Descripción de la Pieza
                  </p>
                  <p className="text-sm">{workPart.part.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Assignment Information */}
        {workPart.assignment && (
          <Card>
            <CardHeader>
              <CardTitle>Información de la Asignación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    ID Asignación
                  </p>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() =>
                      router.push(`/admin/assignments/${workPart.assignmentId}`)
                    }
                  >
                    {workPart.assignmentId}
                  </Button>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Estado
                  </p>
                  <p className="text-sm">
                    {workPart.assignment.status?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Asignado A
                  </p>
                  <p className="text-sm">
                    {workPart.assignment.assignees
                      ?.map((a) => a.user.name)
                      .join(", ") || "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Work Activity Information */}
        {workPart.assignmentActivity && (
          <Card>
            <CardHeader>
              <CardTitle>Actividad de Trabajo</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Descripción de la Actividad
                </p>
                <p className="text-sm">
                  {workPart.assignmentActivity.description}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
