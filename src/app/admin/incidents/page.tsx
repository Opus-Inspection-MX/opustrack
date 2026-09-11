"use client";

import { Eye, Pencil, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  CatalogAction,
  CatalogColumn,
} from "@/components/common/catalog-table";
import { CatalogTable } from "@/components/common/catalog-table";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/incident-types/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/hooks/use-toast";
import { deleteIncident, getIncidents } from "@/lib/actions/incidents";
import { isFailure } from "@/lib/actions/result";
import { logger } from "@/lib/observability/logger";
import { formatIncidentDateTime } from "@/lib/utils/datetime";
import { formatReporter } from "@/lib/utils/incident-display";

type IncidentRow = Awaited<ReturnType<typeof getIncidents>>["data"][number];

function incidentStatusTone(statusName: string | undefined): StatusTone {
  switch (statusName) {
    case "ABIERTO":
    case "ASIGNADO":
      return "open";
    case "VISTO":
      return "info";
    case "INICIADO":
    case "EN_PROGRESO":
      return "progress";
    case "CERRADO":
      return "done";
    case "CANCELADA":
      return "cancelled";
    default:
      return "neutral";
  }
}

const columns: CatalogColumn<IncidentRow>[] = [
  {
    header: "Título",
    cell: (row) => (
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-medium truncate">{row.title}</span>
        <div className="md:hidden flex flex-wrap gap-1">
          {row.type && (
            <Badge variant="outline" className="text-xs">
              {row.type.name}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {row._count.assignments} asignaciones
          </Badge>
        </div>
      </div>
    ),
  },
  {
    header: "Tipo",
    headerClassName: "hidden md:table-cell",
    className: "hidden md:table-cell",
    cell: (row) =>
      row.type ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{row.type.name}</Badge>
          <PriorityBadge priority={row.type.priority} />
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">Sin tipo</span>
      ),
  },
  {
    header: "Estado",
    cell: (row) =>
      row.status ? (
        <StatusBadge tone={incidentStatusTone(row.status.name)}>
          {row.status.name}
        </StatusBadge>
      ) : (
        <span className="text-muted-foreground text-sm">Sin estado</span>
      ),
  },
  {
    header: "Cliente",
    headerClassName: "hidden lg:table-cell",
    className: "hidden lg:table-cell",
    cell: (row) =>
      row.client ? (
        <span className="text-sm">{row.client.name}</span>
      ) : (
        <span className="text-muted-foreground text-sm">Sin Cliente</span>
      ),
  },
  {
    header: "Reportado Por",
    headerClassName: "hidden xl:table-cell",
    className: "hidden xl:table-cell",
    cell: (row) =>
      row.reportedBy || row.reporterName ? (
        <span className="text-sm">
          {formatReporter(row.reportedBy?.name, row.reporterName)}
        </span>
      ) : (
        <span className="text-muted-foreground text-sm">Desconocido</span>
      ),
  },
  {
    header: "Asignaciones",
    headerClassName: "hidden sm:table-cell",
    className: "hidden sm:table-cell",
    cell: (row) => <Badge variant="outline">{row._count.assignments}</Badge>,
  },
  {
    header: "Reportado",
    headerClassName: "hidden md:table-cell",
    className: "hidden md:table-cell text-sm text-muted-foreground",
    cell: (row) =>
      formatIncidentDateTime(row.reportedAt, row.client?.state?.code),
  },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
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
      const result = await getIncidents({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setIncidents(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      logger.error("Error al cargar incidentes:", error);
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

  const actions: CatalogAction<IncidentRow>[] = [
    {
      icon: Eye,
      label: "Ver",
      href: (row) => `/admin/incidents/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/incidents/${row.id}/edit`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar incidente",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar el incidente "${row.title}"? Esta acción no se puede deshacer.`,
      onClick: async (row) => {
        try {
          const result = await deleteIncident(row.id);
          if (isFailure(result)) {
            toast.error(result.error);
            return;
          }
          await fetchData();
        } catch (error) {
          logger.error("deleteIncident failed:", error);
          toast.error("No se pudo completar la operación. Intenta de nuevo.");
        }
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Incidentes"
        description="Administre los incidentes reportados en el sistema"
        actions={
          <>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/admin/incidents/bulk">
                <Upload className="mr-2 h-4 w-4" aria-hidden />
                Carga masiva
              </Link>
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/incidents/new">
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Agregar Incidente
              </Link>
            </Button>
          </>
        }
      />

      <CatalogTable
        data={incidents}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
        mobileCard={(row) => (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={incidentStatusTone(row.status?.name)}>
                {row.status?.name || "Sin estado"}
              </StatusBadge>
              {row.type && (
                <Badge variant="outline" className="text-xs">
                  {row.type.name}
                </Badge>
              )}
            </div>
            <p className="font-medium">{row.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.client?.name || "Sin Cliente"} · {row._count.assignments}{" "}
              asignaciones ·{" "}
              {formatIncidentDateTime(row.reportedAt, row.client?.state?.code)}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/incidents/${row.id}`}>Ver</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/incidents/${row.id}/edit`}>Editar</Link>
              </Button>
            </div>
          </div>
        )}
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Buscar por título o descripción..."
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
        emptyMessage="No hay incidentes registrados."
      />
    </PageContainer>
  );
}
