"use client";

import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IncidentTypeTable } from "@/components/incident-types/incident-type-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { deleteIncidentType, getIncidentTypes } from "@/lib/actions/lookups";

type IncidentType = Awaited<
  ReturnType<typeof getIncidentTypes>
>["data"][number];

export default function IncidentTypesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getIncidentTypes({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
      });

      setIncidentTypes(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching incident types:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (id: number) => {
    router.push(`/admin/incident-types/${id}/edit`);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this incident type?")) {
      try {
        await deleteIncidentType(id);
        await fetchData();
      } catch (error) {
        console.error("Error deleting incident type:", error);
        alert("Failed to delete incident type");
      }
    }
  };

  const handleView = (id: number) => {
    router.push(`/admin/incident-types/${id}`);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on search
  };

  if (isLoading && incidentTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading incident types..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incident Types</h1>
          <p className="text-muted-foreground">
            Manage incident categories and their configurations
          </p>
        </div>
        <Button onClick={() => router.push("/admin/incident-types/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Incident Type
        </Button>
      </div>

      {/* Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o descripción..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <IncidentTypeTable
        data={incidentTypes}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />

      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(value) => {
            setItemsPerPage(value);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}
