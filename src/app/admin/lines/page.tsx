"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type {
  CatalogAction,
  CatalogColumn,
} from "@/components/common/catalog-table";
import { CatalogTable } from "@/components/common/catalog-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/hooks/use-toast";
import { deleteLine, getLines } from "@/lib/actions/lines";
import { isFailure } from "@/lib/actions/result";

type Line = Awaited<ReturnType<typeof getLines>>["data"][number];

const columns: CatalogColumn<Line>[] = [
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
    header: "Cliente",
    cell: (row) => <span className="text-sm">{row.cliente?.name ?? "—"}</span>,
  },
  {
    header: "Equipos",
    cell: (row) => (
      <span className="text-sm text-muted-foreground">
        {row.equipments.length}
      </span>
    ),
  },
  {
    header: "Estado",
    cell: (row) => (
      <Badge variant={row.active ? "default" : "secondary"}>
        {row.active ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
];

export default function LinesPage() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
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
      const result = await getLines({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setLines(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching lines:", error);
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

  const actions: CatalogAction<Line>[] = [
    {
      icon: Eye,
      label: "Ver",
      href: (row) => `/admin/lines/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/lines/${row.id}/edit`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar línea",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar "${row.name}"? Esta acción no se puede deshacer.`,
      disabled: (row) => row.equipments.length > 0,
      onClick: async (row) => {
        try {
          const result = await deleteLine(row.id);
          if (isFailure(result)) {
            toast.error(result.error);
            return;
          }
          await fetchData();
        } catch (error) {
          console.error("deleteLine failed:", error);
          toast.error("No se pudo completar la operación. Intenta de nuevo.");
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Líneas</h1>
          <p className="text-muted-foreground">
            Gestiona las líneas de inspección
          </p>
        </div>
        <Button onClick={() => router.push("/admin/lines/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Línea
        </Button>
      </div>

      <CatalogTable
        data={lines}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Buscar por nombre o descripción..."
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
        emptyMessage="Sin líneas registradas."
      />
    </div>
  );
}
