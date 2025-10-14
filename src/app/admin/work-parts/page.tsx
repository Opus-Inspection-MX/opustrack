"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkPartTable } from "@/components/work-parts/work-part-table";
import { WorkPartFilters } from "@/components/work-parts/work-part-filters";
import { Spinner } from "@/components/ui/spinner";
import { getAllWorkParts, deleteWorkPart } from "@/lib/actions/work-parts";

export default function WorkPartsPage() {
  const [workParts, setWorkParts] = useState<any[]>([]);
  const [filteredWorkParts, setFilteredWorkParts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchWorkParts = async () => {
      try {
        const data = await getAllWorkParts();
        setWorkParts(data);
        setFilteredWorkParts(data);
      } catch (error) {
        console.error("Error fetching work parts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkParts();
  }, []);

  const handleFiltersChange = (filters: {
    search: string;
    partId: string;
    workOrderStatus: string;
    active: string;
  }) => {
    let filtered = workParts;

    if (filters.search) {
      filtered = filtered.filter(
        (wp) =>
          wp.part?.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          wp.description?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.partId) {
      filtered = filtered.filter((wp) => wp.part?.id === filters.partId);
    }

    if (filters.workOrderStatus) {
      filtered = filtered.filter(
        (wp) => wp.workOrder?.status === filters.workOrderStatus
      );
    }

    if (filters.active) {
      filtered = filtered.filter(
        (wp) => wp.active === (filters.active === "true")
      );
    }

    setFilteredWorkParts(filtered);
  };

  const handleEdit = (id: string) => {
    router.push(`/admin/work-parts/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this work part? Stock will be restored."
      )
    ) {
      try {
        await deleteWorkPart(id);
        // Refresh the list
        const updatedParts = workParts.filter((wp) => wp.id !== id);
        setWorkParts(updatedParts);
        setFilteredWorkParts(
          filteredWorkParts.filter((wp) => wp.id !== id)
        );
      } catch (error) {
        console.error("Error deleting work part:", error);
        alert(
          error instanceof Error ? error.message : "Failed to delete work part"
        );
      }
    }
  };

  const handleView = (id: string) => {
    router.push(`/admin/work-parts/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading work parts..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Work Parts</h1>
          <p className="text-muted-foreground">
            Track parts usage in work orders and activities
          </p>
        </div>
        <Button onClick={() => router.push("/admin/work-parts/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Work Part
        </Button>
      </div>

      <WorkPartFilters onFiltersChange={handleFiltersChange} />

      <WorkPartTable
        data={filteredWorkParts}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  );
}
