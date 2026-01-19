"use client";

import { Calendar, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ScheduleTable } from "@/components/schedules/schedule-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { deleteSchedule, getSchedules } from "@/lib/actions/schedules";

interface VIC {
  id: string;
  name: string;
  code: string;
}

interface IncidentStatus {
  id: number;
  name: string;
}

interface Schedule {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  endDate?: string | null;
  vicId: string;
  vicName: string;
  incidentCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleApiResponse {
  id: string;
  title: string;
  description?: string | null;
  scheduledAt: Date | string;
  endDate?: Date | string | null;
  vicId: string;
  vic?: { name: string };
  _count?: { incidents: number };
  active: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export default function SchedulesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vics, setVics] = useState<VIC[]>([]);
  const [statuses, setStatuses] = useState<IncidentStatus[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVic, setSelectedVic] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchVics = useCallback(async () => {
    try {
      const response = await fetch("/api/vics");
      if (!response.ok) return;
      const result = await response.json();
      setVics(result.data || []);
    } catch (error) {
      console.error("Error fetching VICs:", error);
    }
  }, []);

  const fetchStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/incident-statuses");
      if (!response.ok) return;
      const result = await response.json();
      setStatuses(result.data || []);
    } catch (error) {
      console.error("Error fetching statuses:", error);
    }
  }, []);

  const fetchSchedulesData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSchedules({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        vicId: selectedVic !== "all" ? selectedVic : undefined,
        statusId:
          selectedStatus !== "all" ? parseInt(selectedStatus, 10) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      // Transform data to match table expectations
      const transformed: Schedule[] = result.data.map(
        (schedule: ScheduleApiResponse) => ({
          id: schedule.id,
          title: schedule.title,
          description: schedule.description ?? undefined,
          scheduledAt:
            typeof schedule.scheduledAt === "string"
              ? schedule.scheduledAt
              : new Date(schedule.scheduledAt).toISOString(),
          endDate: schedule.endDate
            ? typeof schedule.endDate === "string"
              ? schedule.endDate
              : new Date(schedule.endDate).toISOString()
            : null,
          vicId: schedule.vicId,
          vicName: schedule.vic?.name || "Unknown VIC",
          incidentCount: schedule._count?.incidents || 0,
          active: schedule.active,
          createdAt:
            typeof schedule.createdAt === "string"
              ? schedule.createdAt
              : new Date(schedule.createdAt).toISOString(),
          updatedAt: schedule.updatedAt
            ? typeof schedule.updatedAt === "string"
              ? schedule.updatedAt
              : new Date(schedule.updatedAt).toISOString()
            : new Date().toISOString(),
        }),
      );

      setSchedules(transformed);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    selectedVic,
    selectedStatus,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    fetchVics();
    fetchStatuses();
  }, [fetchStatuses, fetchVics]);

  useEffect(() => {
    fetchSchedulesData();
  }, [fetchSchedulesData]);

  const handleEdit = (id: string) => {
    router.push(`/admin/schedules/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      try {
        await deleteSchedule(id);
        await fetchSchedulesData();
      } catch (error) {
        console.error("Error deleting schedule:", error);
        alert(
          error instanceof Error ? error.message : "Failed to delete schedule",
        );
      }
    }
  };

  const handleView = (id: string) => {
    router.push(`/admin/schedules/${id}`);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page on filter change
  };

  if (isLoading && schedules.length === 0) {
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

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título o descripción..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">VIC</Label>
          <Select
            value={selectedVic}
            onValueChange={(value) => {
              setSelectedVic(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los VICs</SelectItem>
              {vics.map((vic) => (
                <SelectItem key={vic.id} value={vic.id}>
                  {vic.name} ({vic.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Estado</Label>
          <Select
            value={selectedStatus}
            onValueChange={(value) => {
              setSelectedStatus(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={status.id.toString()}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Rango de Fechas</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  handleFilterChange();
                }}
                className="pl-8"
              />
            </div>
            <div className="relative flex-1">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  handleFilterChange();
                }}
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </div>

      <ScheduleTable
        data={schedules}
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
