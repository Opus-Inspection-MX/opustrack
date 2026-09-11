"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type {
  CatalogAction,
  CatalogColumn,
} from "@/components/common/catalog-table";
import { CatalogTable } from "@/components/common/catalog-table";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/hooks/use-toast";
import {
  deleteIncidentStatus,
  getIncidentStatuses,
} from "@/lib/actions/lookups";
import { isFailure } from "@/lib/actions/result";
import { logger } from "@/lib/observability/logger";

type IncidentStatus = Awaited<
  ReturnType<typeof getIncidentStatuses>
>["data"][number];

const columns: CatalogColumn<IncidentStatus>[] = [
  {
    header: "ID",
    cell: (row) => <span className="font-mono text-sm">{row.id}</span>,
  },
  {
    header: "Nombre",
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    header: "Color",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded border border-gray-300"
          style={{ backgroundColor: row.color }}
          title={row.color}
        />
        <span className="font-mono text-sm text-muted-foreground">
          {row.color}
        </span>
      </div>
    ),
  },
  {
    header: "Vista previa",
    cell: (row) => (
      <Badge
        style={{
          backgroundColor: row.color,
          color: "#FFFFFF",
          borderColor: row.color,
        }}
      >
        {row.name}
      </Badge>
    ),
  },
  {
    header: "Incidentes",
    cell: (row) => (
      <span className="text-sm text-muted-foreground">{row.incidentCount}</span>
    ),
  },
  {
    header: "Estado",
    cell: (row) => (
      <StatusBadge tone={row.active ? "success" : "neutral"}>
        {row.active ? "Activo" : "Inactivo"}
      </StatusBadge>
    ),
  },
];

export default function IncidentStatusPage() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<IncidentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getIncidentStatuses({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setStatuses(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      logger.error("Error fetching incident statuses:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const actions: CatalogAction<IncidentStatus>[] = [
    {
      icon: Eye,
      label: "Ver",
      href: (row) => `/admin/incident-status/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/incident-status/${row.id}/edit`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar estado de incidente",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar "${row.name}"? Esta acción no se puede deshacer.`,
      disabled: (row) => row.incidentCount > 0,
      onClick: async (row) => {
        try {
          const result = await deleteIncidentStatus(row.id);
          if (isFailure(result)) {
            toast.error(result.error);
            return;
          }
          await fetchData();
        } catch (error) {
          logger.error("deleteIncidentStatus failed:", error);
          toast.error("No se pudo completar la operación. Intenta de nuevo.");
        }
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Estado de Incidente"
        description="Gestionar tipos de estado de incidente y sus configuraciones"
        actions={
          <Button
            onClick={() => router.push("/admin/incident-status/new")}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Nuevo Estado
          </Button>
        }
      />

      <CatalogTable
        data={statuses}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
        mobileCard={(row) => (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              <p className="font-medium">{row.name}</p>
              <StatusBadge tone={row.active ? "success" : "neutral"}>
                {row.active ? "Activo" : "Inactivo"}
              </StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">
              {row.incidentCount} incidentes
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/incident-status/${row.id}`}>Ver</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/incident-status/${row.id}/edit`}>
                  Editar
                </Link>
              </Button>
            </div>
          </div>
        )}
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Buscar por nombre..."
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(value) => {
          setItemsPerPage(value);
          setCurrentPage(1);
        }}
        loading={isLoading}
        emptyMessage="Sin estados de incidente."
      />
    </PageContainer>
  );
}
