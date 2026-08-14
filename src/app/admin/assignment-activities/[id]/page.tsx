"use client";

import { Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/use-toast";
import {
  deleteAssignmentActivity,
  getAssignmentActivityById,
} from "@/lib/actions/assignment-activities";
import { isFailure } from "@/lib/actions/result";
import { formatMX } from "@/lib/utils/datetime";

interface Part {
  id: string;
  name: string;
}

interface WorkPart {
  id: string;
  partId: string;
  quantity: number;
  price?: number | null;
  description?: string | null;
  part?: Part | null;
}

interface AssignedUser {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  status?: { name: string } | string | null;
  assignees?: Array<{ user: AssignedUser }>;
  incident?: { id: number; title: string } | null;
}

interface AssignmentActivity {
  id: string;
  description: string;
  performedAt: Date | string;
  assignmentId: string;
  assignment?: Assignment | null;
  workParts?: WorkPart[];
}

export default function AssignmentActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activity, setActivity] = useState<AssignmentActivity | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const data = await getAssignmentActivityById(id);
        setActivity(data);
      } catch (error) {
        console.error("Error fetching work activity:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [id]);

  const handleDelete = async () => {
    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar esta actividad de trabajo?",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const assignmentId = activity?.assignmentId;
      const result = await deleteAssignmentActivity(id);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      router.push(
        assignmentId
          ? `/admin/assignments/${assignmentId}`
          : "/admin/assignments",
      );
    } catch (error) {
      console.error("Error deleting work activity:", error);
      toast.error("Error al eliminar la actividad de trabajo");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando actividad de trabajo..." />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton fallback="/admin/assignment-activities" />
          <div>
            <h1 className="text-3xl font-bold">
              Actividad de Trabajo No Encontrada
            </h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallback="/admin/assignment-activities" />
          <div>
            <h1 className="text-3xl font-bold">Detalles de la Actividad</h1>
            <p className="text-muted-foreground">
              Ver información de la actividad de trabajo
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/admin/assignment-activities/${id}/edit`)
            }
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
        {/* Work Activity Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la Actividad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  ID de Actividad
                </p>
                <p className="text-sm">{activity.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Realizada El
                </p>
                <p className="text-sm">{formatMX(activity.performedAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Descripción
              </p>
              <p className="text-sm whitespace-pre-wrap">
                {activity.description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Assignment Information */}
        {activity.assignment && (
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
                      router.push(`/admin/assignments/${activity.assignmentId}`)
                    }
                  >
                    {activity.assignmentId}
                  </Button>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Estado
                  </p>
                  <p className="text-sm">
                    {typeof activity.assignment.status === "object"
                      ? activity.assignment.status?.name
                      : activity.assignment.status || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Asignado A
                  </p>
                  <p className="text-sm">
                    {activity.assignment.assignees
                      ?.map((a) => a.user.name)
                      .join(", ") || "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Work Parts Used */}
        {activity.workParts && activity.workParts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                Refacciones Usadas ({activity.workParts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activity.workParts.map((workPart: WorkPart) => (
                  <div
                    key={workPart.id}
                    className="flex justify-between items-center p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{workPart.part?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {workPart.description || "Sin descripción"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Cant: {workPart.quantity}</p>
                      <p className="text-sm font-medium">
                        ${workPart.price?.toFixed(2) || "0.00"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
