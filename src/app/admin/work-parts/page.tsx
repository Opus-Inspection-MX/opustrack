"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WorkPartFilters } from "@/components/work-parts/work-part-filters";
import { WorkPartTable } from "@/components/work-parts/work-part-table";
import { deleteWorkPart, getAllWorkParts } from "@/lib/actions/work-parts";

// API response types (nullable fields from database)
interface ApiPart {
  id: string;
  name: string;
  price?: number | null;
}

interface ApiWorkOrderStatus {
  name: string;
}

interface ApiWorkOrderIncident {
  title: string;
}

interface ApiWorkOrder {
  id: string;
  status?: ApiWorkOrderStatus | null;
  incident?: ApiWorkOrderIncident | null;
}

interface ApiWorkActivity {
  id: string;
  description: string;
}

interface ApiWorkPart {
  id: string;
  workOrderId?: string | null;
  partId: string;
  quantity: number;
  price?: number | null;
  description?: string | null;
  active: boolean;
  createdAt: string | Date;
  part?: ApiPart | null;
  workOrder?: ApiWorkOrder | null;
  workActivity?: ApiWorkActivity | null;
}

// Table component types (required fields for display)
interface TableWorkPart {
  id: string;
  part: {
    id: string;
    name: string;
    price: number;
  };
  quantity: number;
  description?: string;
  price: number;
  workOrder?: {
    id: string;
    status?: {
      name: string;
    };
    incident: {
      title: string;
    };
  };
  workActivity?: {
    id: string;
    description: string;
  };
  createdAt: string;
  active: boolean;
}

// Transform API data to table-compatible format
function transformWorkPart(wp: ApiWorkPart): TableWorkPart | null {
  // Skip records without part data
  if (!wp.part) return null;

  return {
    id: wp.id,
    part: {
      id: wp.part.id,
      name: wp.part.name,
      price: wp.part.price ?? 0,
    },
    quantity: wp.quantity,
    description: wp.description ?? undefined,
    price: wp.price ?? 0,
    workOrder: wp.workOrder?.incident
      ? {
          id: wp.workOrder.id,
          status: wp.workOrder.status ?? undefined,
          incident: { title: wp.workOrder.incident.title },
        }
      : undefined,
    workActivity: wp.workActivity ?? undefined,
    createdAt:
      typeof wp.createdAt === "string"
        ? wp.createdAt
        : wp.createdAt.toISOString(),
    active: wp.active,
  };
}

export default function WorkPartsPage() {
  const [workParts, setWorkParts] = useState<TableWorkPart[]>([]);
  const [filteredWorkParts, setFilteredWorkParts] = useState<TableWorkPart[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchWorkParts = async () => {
      try {
        const data = (await getAllWorkParts()) as ApiWorkPart[];
        const transformed = data
          .map(transformWorkPart)
          .filter((wp): wp is TableWorkPart => wp !== null);
        setWorkParts(transformed);
        setFilteredWorkParts(transformed);
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
          wp.part.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          wp.description?.toLowerCase().includes(filters.search.toLowerCase()),
      );
    }

    if (filters.partId) {
      filtered = filtered.filter((wp) => wp.part.id === filters.partId);
    }

    if (filters.workOrderStatus) {
      filtered = filtered.filter(
        (wp) => wp.workOrder?.status?.name === filters.workOrderStatus,
      );
    }

    if (filters.active) {
      filtered = filtered.filter(
        (wp) => wp.active === (filters.active === "true"),
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
        "Are you sure you want to delete this work part? Stock will be restored.",
      )
    ) {
      try {
        await deleteWorkPart(id);
        // Refresh the list
        const updatedParts = workParts.filter((wp) => wp.id !== id);
        setWorkParts(updatedParts);
        setFilteredWorkParts(filteredWorkParts.filter((wp) => wp.id !== id));
      } catch (error) {
        console.error("Error deleting work part:", error);
        alert(
          error instanceof Error ? error.message : "Failed to delete work part",
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
