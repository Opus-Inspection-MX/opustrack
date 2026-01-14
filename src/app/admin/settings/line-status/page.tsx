"use client";

import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GenericStatusTable } from "@/components/settings/generic-status-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { deleteLineStatus, getLineStatuses } from "@/lib/actions/lookups";

type LineStatus = Awaited<ReturnType<typeof getLineStatuses>>["data"][number];

export default function LineStatusPage() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<LineStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const result = await getLineStatuses({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
      });

      setStatuses(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching line statuses:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (id: number) => {
    router.push(`/admin/settings/line-status/${id}/edit`);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this line status?")) {
      try {
        await deleteLineStatus(id);
        await fetchData();
      } catch (error) {
        console.error("Error deleting line status:", error);
        alert("Failed to delete line status");
      }
    }
  };

  const handleView = (id: number) => {
    router.push(`/admin/settings/line-status/${id}`);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on search
  };

  if (isLoading && statuses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading line statuses..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Line Status</h1>
          <p className="text-muted-foreground">
            Manage verification line status types
          </p>
        </div>
        <Button onClick={() => router.push("/admin/settings/line-status/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Status
        </Button>
      </div>

      {/* Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <GenericStatusTable
        data={statuses}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        countLabel="Lines Using"
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
