"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StateTable } from "@/components/states/state-table";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteState, getStatesAdmin } from "@/lib/actions/lookups";

interface StateApiResponse {
  id: number;
  name: string;
  code: string;
  active: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  _count?: {
    vehicleInspectionCenters: number;
  };
}

interface State {
  id: number;
  name: string;
  code: string;
  vicCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function StatesPage() {
  const [states, setStates] = useState<State[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const router = useRouter();

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const data = await getStatesAdmin();
        // Transform data to match table expectations
        const transformed: State[] = data.map((state: StateApiResponse) => ({
          id: state.id,
          name: state.name,
          code: state.code,
          vicCount: state._count?.vehicleInspectionCenters || 0,
          active: state.active,
          createdAt:
            typeof state.createdAt === "string"
              ? state.createdAt
              : new Date(state.createdAt).toISOString(),
          updatedAt:
            typeof state.updatedAt === "string"
              ? state.updatedAt
              : new Date(state.updatedAt).toISOString(),
        }));
        setStates(transformed);
      } catch (error) {
        console.error("Error fetching states:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStates();
  }, []);

  const handleEdit = (id: number) => {
    router.push(`/admin/states/${id}/edit`);
  };

  const handleDelete = async (id: number) => {
    const state = states.find((s) => s.id === id);
    if (state?.vicCount && state.vicCount > 0) {
      alert(
        "Cannot delete state with associated VIC centers. Please reassign or delete VIC centers first.",
      );
      return;
    }

    if (confirm("Are you sure you want to delete this state?")) {
      try {
        await deleteState(id);
        // Refresh the list
        setStates((prev) => prev.filter((s) => s.id !== id));
      } catch (error) {
        console.error("Error deleting state:", error);
        alert(
          error instanceof Error ? error.message : "Failed to delete state",
        );
      }
    }
  };

  const handleView = (id: number) => {
    router.push(`/admin/states/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading states..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">States</h1>
          <p className="text-muted-foreground">
            Manage geographic states and regions
          </p>
        </div>
        <Button onClick={() => router.push("/admin/states/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add State
        </Button>
      </div>

      <StateTable
        states={states}
        totalCount={states.length}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  );
}
