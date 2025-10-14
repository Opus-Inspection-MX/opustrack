"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleTable } from "@/components/schedules/schedule-table";
import { Spinner } from "@/components/ui/spinner";
import { getSchedules, deleteSchedule } from "@/lib/actions/schedules";

export default function SchedulesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const data = await getSchedules();
        // Transform data to match table expectations
        const transformed = data.map((schedule: any) => ({
          id: schedule.id,
          title: schedule.title,
          description: schedule.description,
          scheduledAt: schedule.scheduledAt,
          vicId: schedule.vicId,
          vicName: schedule.vic?.name || "Unknown VIC",
          incidentCount: schedule._count?.incidents || 0,
          active: schedule.active,
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt,
        }));
        setSchedules(transformed);
      } catch (error) {
        console.error("Error fetching schedules:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedules();
  }, []);

  const handleEdit = (id: string) => {
    router.push(`/admin/schedules/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      try {
        await deleteSchedule(id);
        // Refresh the list
        setSchedules((prev) => prev.filter((s) => s.id !== id));
      } catch (error) {
        console.error("Error deleting schedule:", error);
        alert(
          error instanceof Error ? error.message : "Failed to delete schedule"
        );
      }
    }
  };

  const handleView = (id: string) => {
    router.push(`/admin/schedules/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading schedules..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">
            Manage maintenance schedules and planned activities
          </p>
        </div>
        <Button onClick={() => router.push("/admin/schedules/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      <ScheduleTable
        data={schedules}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  );
}
