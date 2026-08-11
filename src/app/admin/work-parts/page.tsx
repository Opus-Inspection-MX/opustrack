"use client";

import { isFailure } from "@/lib/actions/result";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WorkPartFilters } from "@/components/work-parts/work-part-filters";
import { WorkPartTable } from "@/components/work-parts/work-part-table";
import { toast } from "@/hooks/use-toast";
import { deleteWorkPart, getAllWorkParts } from "@/lib/actions/work-parts";

// API response types (nullable fields from database)
interface ApiPart {
  id: string;
  name: string;
  price?: number | null;
}

interface ApiAssignmentStatus {
  name: string;
}

interface ApiAssignmentIncident {
  title: string;
}

interface ApiAssignment {
  id: string;
  status?: ApiAssignmentStatus | null;
  incident?: ApiAssignmentIncident | null;
}

interface ApiAssignmentActivity {
  id: string;
  description: string;
}

interface ApiWorkPart {
  id: string;
  assignmentId?: string | null;
  partId: string;
  quantity: number;
  price?: number | null;
  description?: string | null;
  active: boolean;
  createdAt: string | Date;
  part?: ApiPart | null;
  assignment?: ApiAssignment | null;
  activity?: ApiAssignmentActivity | null;
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
  assignment?: {
    id: string;
    status?: {
      name: string;
    };
    incident: {
      title: string;
    };
  };
  assignmentActivity?: {
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
    assignment: wp.assignment?.incident
      ? {
          id: wp.assignment.id,
          status: wp.assignment.status ?? undefined,
          incident: { title: wp.assignment.incident.title },
        }
      : undefined,
    assignmentActivity: wp.activity ?? undefined,
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
    assignmentStatus: string;
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

    if (filters.assignmentStatus) {
      filtered = filtered.filter(
        (wp) => wp.assignment?.status?.name === filters.assignmentStatus,
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
        "¿Estás seguro de que deseas eliminar esta refacción? El stock será restaurado.",
      )
    ) {
      try {
        const result = await deleteWorkPart(id);

        if (isFailure(result)) {
          toast.error(result.error);
          return;
        }
        // Refresh the list
        const updatedParts = workParts.filter((wp) => wp.id !== id);
        setWorkParts(updatedParts);
        setFilteredWorkParts(filteredWorkParts.filter((wp) => wp.id !== id));
      } catch (error) {
        console.error("Error deleting work part:", error);
        toast.error("Error al eliminar la refacción");
      }
    }
  };

  const handleView = (id: string) => {
    router.push(`/admin/work-parts/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando refacciones..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Refacciones Usadas</h1>
          <p className="text-muted-foreground">
            Seguimiento del uso de refacciones en órdenes y actividades
          </p>
        </div>
        <Button onClick={() => router.push("/admin/work-parts/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar Refacción
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
