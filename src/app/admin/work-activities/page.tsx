"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WorkActivityTable } from "@/components/work-activities/work-activity-table";
import {
  deleteWorkActivity,
  getAllWorkActivities,
} from "@/lib/actions/work-activities";

interface WorkActivityApiResponse {
  id: string;
  description: string;
  performedAt: Date | string;
  workOrderId: string;
  workOrder?: {
    incident?: {
      title: string;
    } | null;
  } | null;
  workParts?: unknown[];
  active: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface WorkActivity {
  id: string;
  description: string;
  performedAt: string;
  workOrderId: string;
  workOrderTitle: string;
  partsCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function WorkActivitiesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [workActivities, setWorkActivities] = useState<WorkActivity[]>([]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const data = await getAllWorkActivities();
        // Transform data to match table expectations
        const transformed: WorkActivity[] = data.map(
          (activity: WorkActivityApiResponse) => ({
            id: activity.id,
            description: activity.description,
            performedAt:
              typeof activity.performedAt === "string"
                ? activity.performedAt
                : new Date(activity.performedAt).toISOString(),
            workOrderId: activity.workOrderId,
            workOrderTitle:
              activity.workOrder?.incident?.title || "No incident linked",
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
        setWorkActivities(transformed);
      } catch (error) {
        console.error("Error fetching work activities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const handleEdit = (id: string) => {
    router.push(`/admin/work-activities/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this work activity?")) {
      try {
        await deleteWorkActivity(id);
        // Refresh the list
        setWorkActivities((prev) => prev.filter((item) => item.id !== id));
      } catch (error) {
        console.error("Error deleting work activity:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to delete work activity",
        );
      }
    }
  };

  const handleView = (id: string) => {
    router.push(`/admin/work-activities/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading work activities..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Work Activities</h1>
          <p className="text-muted-foreground">
            Track and manage detailed work activities and tasks
          </p>
        </div>
        <Button onClick={() => router.push("/admin/work-activities/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Work Activity
        </Button>
      </div>

      <WorkActivityTable
        data={workActivities}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  );
}
