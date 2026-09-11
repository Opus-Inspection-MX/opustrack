"use client";

import { Calendar, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { QuickEditScheduleDialog } from "@/components/admin/schedules/quick-edit-schedule-dialog";
import { FilterBar } from "@/components/common/filter-bar";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { TableSkeleton } from "@/components/common/skeletons";
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
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { deleteSchedule, getSchedules } from "@/lib/actions/schedules";
import { logger } from "@/lib/observability/logger";

interface Client {
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
  clients: Array<{ id: string; code: string; name: string }>;
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
  clients?: Array<{
    clientId: string;
    active: boolean;
    client: { id: string; code: string; name: string };
  }>;
  _count?: { incidents: number };
  active: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export default function SchedulesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [clients, setClientes] = useState<Client[]>([]);
  const [statuses, setStatuses] = useState<IncidentStatus[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Quick-edit dialog state
  const [quickEditId, setQuickEditId] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    try {
      const response = await fetch("/api/clients");
      if (!response.ok) return;
      const result = await response.json();
      setClientes(result.data || []);
    } catch (error) {
      logger.error("Error fetching Clientes:", error);
    }
  }, []);

  const fetchStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/incident-statuses");
      if (!response.ok) return;
      const result = await response.json();
      setStatuses(result.data || []);
    } catch (error) {
      logger.error("Error fetching statuses:", error);
    }
  }, []);

  const fetchSchedulesData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSchedules({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        clientId: selectedCliente !== "all" ? selectedCliente : undefined,
        statusId:
          selectedStatus !== "all" ? parseInt(selectedStatus, 10) : undefined,
        activeFrom: startDate ? new Date(startDate) : undefined,
        activeTo: endDate ? new Date(endDate) : undefined,
      });

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
          clients: (schedule.clients ?? [])
            .filter((sv) => sv.active)
            .map((sv) => sv.client),
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
      logger.error("Error fetching schedules:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    selectedCliente,
    selectedStatus,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    fetchClientes();
    fetchStatuses();
  }, [fetchStatuses, fetchClientes]);

  useEffect(() => {
    fetchSchedulesData();
  }, [fetchSchedulesData]);

  const handleEdit = (id: string) => {
    router.push(`/admin/schedules/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta programación?")) {
      try {
        const result = await deleteSchedule(id);

        if (isFailure(result)) {
          toast.error(result.error);
          return;
        }
        await fetchSchedulesData();
      } catch (error) {
        logger.error("Error deleting schedule:", error);
        toast.error("Error al eliminar la programación");
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

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCliente("all");
    setSelectedStatus("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (selectedCliente !== "all" ? 1 : 0) +
    (selectedStatus !== "all" ? 1 : 0) +
    (startDate || endDate ? 1 : 0);

  if (isLoading && schedules.length === 0) {
    return (
      <PageContainer>
        <PageHeader
          title="Programación"
          description="Gestionar programaciones de mantenimiento y actividades planificadas"
        />
        <TableSkeleton rows={5} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Programación"
        description="Gestionar programaciones de mantenimiento y actividades planificadas"
        actions={
          <Button
            onClick={() => router.push("/admin/schedules/new")}
            className="min-h-[44px] w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Nueva Programación
          </Button>
        }
      />

      {/* Filters */}
      <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium" htmlFor="schedule-search">
              Buscar
            </Label>
            <div className="relative">
              <Search
                className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="schedule-search"
                placeholder="Buscar por título o descripción..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium" htmlFor="schedule-client">
              Cliente
            </Label>
            <Select
              value={selectedCliente}
              onValueChange={(value) => {
                setSelectedCliente(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger id="schedule-client" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Clientes</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} ({client.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium" htmlFor="schedule-status">
              Estado
            </Label>
            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger id="schedule-status" className="w-full">
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
                <Calendar
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                  aria-hidden
                />
                <Input
                  type="date"
                  value={startDate}
                  aria-label="Fecha de inicio"
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    handleFilterChange();
                  }}
                  className="pl-8"
                />
              </div>
              <div className="relative flex-1">
                <Calendar
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                  aria-hidden
                />
                <Input
                  type="date"
                  value={endDate}
                  aria-label="Fecha de fin"
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
      </FilterBar>

      <ScheduleTable
        data={schedules}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onQuickEdit={(id) => setQuickEditId(id)}
      />

      <QuickEditScheduleDialog
        scheduleId={quickEditId}
        clients={clients}
        open={quickEditId !== null}
        onOpenChange={(open) => {
          if (!open) setQuickEditId(null);
        }}
        onSaved={() => {
          setQuickEditId(null);
          fetchSchedulesData();
        }}
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
    </PageContainer>
  );
}
