"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AssignmentActivityTable } from "@/components/assignment-activities/assignment-activity-table";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/use-toast";
import {
  deleteAssignmentActivity,
  getAllAssignmentActivities,
} from "@/lib/actions/assignment-activities";
import { isFailure } from "@/lib/actions/result";

interface AssignmentActivityApiResponse {
  id: string;
  description: string;
  performedAt: Date | string;
  assignmentId: string;
  assignment?: {
    incident?: {
      title: string;
    } | null;
  } | null;
  workParts?: unknown[];
  active: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface AssignmentActivity {
  id: string;
  description: string;
  performedAt: string;
  assignmentId: string;
  assignmentTitle: string;
  partsCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AssignmentActivitiesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [assignmentActivities, setAssignmentActivities] = useState<
    AssignmentActivity[]
  >([]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const data = await getAllAssignmentActivities();
        // Transform data to match table expectations
        const transformed: AssignmentActivity[] = data.map(
          (activity: AssignmentActivityApiResponse) => ({
            id: activity.id,
            description: activity.description,
            performedAt:
              typeof activity.performedAt === "string"
                ? activity.performedAt
                : new Date(activity.performedAt).toISOString(),
            assignmentId: activity.assignmentId,
            assignmentTitle:
              activity.assignment?.incident?.title || "No incident linked",
            partsCount: activity.workParts?.length || 0,
            active: activity.active,
            createdAt:
              typeof activity.createdAt === "string"
                ? activity.createdAt
                : new Date(activity.createdAt).toISOString(),
            updatedAt:
              typeof activity.updatedAt === "string"
                ? activity.updatedAt
                : new Date(activity.updatedAt).toISOString(),
          }),
        );
        setAssignmentActivities(transformed);
      } catch (error) {
        console.error("Error fetching work activities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const handleEdit = (id: string) => {
    router.push(`/admin/assignment-activities/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (
      confirm("¿Estás seguro de que deseas eliminar esta actividad de trabajo?")
    ) {
      try {
        const result = await deleteAssignmentActivity(id);

        if (isFailure(result)) {
          toast.error(result.error);
          return;
        }
        // Refresh the list
        setAssignmentActivities((prev) =>
          prev.filter((item) => item.id !== id),
        );
      } catch (error) {
        console.error("Error deleting work activity:", error);
        toast.error("Error al eliminar la actividad de trabajo");
      }
    }
  };

  const handleView = (id: string) => {
    router.push(`/admin/assignment-activities/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando actividades de trabajo..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Actividades de Trabajo</h1>
          <p className="text-muted-foreground">
            Seguimiento y gestión de actividades de trabajo detalladas
          </p>
        </div>
        <Button onClick={() => router.push("/admin/assignment-activities/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Actividad
        </Button>
      </div>

      <AssignmentActivityTable
        data={assignmentActivities}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  );
}
