"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { deleteIncidentType, getIncidentTypes } from "@/lib/actions/lookups";

type IncidentType = Awaited<
  ReturnType<typeof getIncidentTypes>
>["data"][number];

const columns: CatalogColumn<IncidentType>[] = [
  {
    header: "ID",
    cell: (row) => <span className="font-mono text-sm">{row.id}</span>,
  },
  {
    header: "Nombre",
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    header: "Descripción",
    cell: (row) =>
      row.description ? (
        <span className="text-sm text-muted-foreground">
          {row.description.length > 50
            ? `${row.description.substring(0, 50)}...`
            : row.description}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground italic">
          Sin descripción
        </span>
      ),
  },
  {
    header: "Prioridad",
    cell: (row) => <PriorityBadge priority={row.priority} />,
  },
  {
    header: "Estado",
    cell: (row) => (
      <Badge variant={row.active ? "default" : "secondary"}>
        {row.active ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
  {
    header: "Incidentes",
    cell: (row) => (
      <span className="text-sm text-muted-foreground">{row.incidentCount}</span>
    ),
  },
];

export default function IncidentTypesPage() {
  const router = useRouter();
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
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
      const result = await getIncidentTypes({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setIncidentTypes(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching incident types:", error);
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

  const actions: CatalogAction<IncidentType>[] = [
    {
      icon: Eye,
      label: "Ver",
      href: (row) => `/admin/incident-types/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/incident-types/${row.id}/edit`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar tipo de incidente",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar "${row.name}"? Esta acción no se puede deshacer.`,
      disabled: (row) => row.incidentCount > 0,
      onClick: async (row) => {
        try {
          await deleteIncidentType(row.id);
          await fetchData();
        } catch (error) {
          console.error("Error deleting incident type:", error);
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tipos de Incidente</h1>
          <p className="text-muted-foreground">
            Gestionar categorías de incidentes y sus configuraciones
          </p>
        </div>
        <Button onClick={() => router.push("/admin/incident-types/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Tipo de Incidente
        </Button>
      </div>

      <CatalogTable
        data={incidentTypes}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
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
        emptyMessage="Sin tipos de incidente."
      />
    </div>
  );
}
