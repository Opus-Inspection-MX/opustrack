"use client";

import { Eye, Pencil, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  CatalogAction,
  CatalogColumn,
} from "@/components/common/catalog-table";
import { CatalogTable } from "@/components/common/catalog-table";
import { PriorityBadge } from "@/components/incident-types/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { deleteIncident, getIncidents } from "@/lib/actions/incidents";

type IncidentRow = Awaited<ReturnType<typeof getIncidents>>["data"][number];

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
        <Badge variant="secondary">{row.status.name}</Badge>
      ) : (
        <span className="text-muted-foreground text-sm">Sin estado</span>
      ),
  },
  {
    header: "Cliente",
    headerClassName: "hidden lg:table-cell",
    className: "hidden lg:table-cell",
    cell: (row) =>
      row.cliente ? (
        <span className="text-sm">{row.cliente.name}</span>
      ) : (
        <span className="text-muted-foreground text-sm">Sin Cliente</span>
      ),
  },
  {
    header: "Reportado Por",
    headerClassName: "hidden xl:table-cell",
    className: "hidden xl:table-cell",
    cell: (row) =>
      row.reportedBy ? (
        <span className="text-sm">{row.reportedBy.name}</span>
      ) : (
        <span className="text-muted-foreground text-sm">Desconocido</span>
      ),
  },
  {
    header: "Órdenes",
    headerClassName: "hidden sm:table-cell",
    className: "hidden sm:table-cell",
    cell: (row) => <Badge variant="outline">{row._count.assignments}</Badge>,
  },
  {
    header: "Fecha",
    headerClassName: "hidden md:table-cell",
    className: "hidden md:table-cell text-sm text-muted-foreground",
    cell: (row) => new Date(row.reportedAt).toLocaleDateString(),
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
      console.error("Error al cargar incidentes:", error);
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
          await deleteIncident(row.id);
          await fetchData();
        } catch (error) {
          console.error("Error al eliminar incidente:", error);
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incidentes</h1>
          <p className="text-muted-foreground">
            Administre los incidentes reportados en el sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/incidents/bulk">
              <Upload className="mr-2 h-4 w-4" />
              Carga masiva
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/incidents/new">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Incidente
            </Link>
          </Button>
        </div>
      </div>

      <CatalogTable
        data={incidents}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
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
    </div>
  );
}
