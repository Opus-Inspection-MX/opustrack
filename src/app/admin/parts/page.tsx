"use client";

import { Eye, Package, Pencil, Plus, Trash2 } from "lucide-react";
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
import { deletePart, getParts } from "@/lib/actions/parts";
import { isFailure } from "@/lib/actions/result";

type Part = Awaited<ReturnType<typeof getParts>>["data"][number];

const getStockVariant = (
  stock: number,
): "destructive" | "default" | "secondary" => {
  if (stock === 0) return "destructive";
  if (stock < 10) return "default";
  return "secondary";
};

const columns: CatalogColumn<Part>[] = [
  {
    header: "Nombre",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-primary shrink-0" />
        <span className="font-medium">{row.name}</span>
      </div>
    ),
  },
  {
    header: "Descripción",
    cell: (row) =>
      row.description ? (
        <span className="text-sm text-muted-foreground max-w-xs truncate block">
          {row.description}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground italic">
          Sin descripción
        </span>
      ),
  },
  {
    header: "Precio",
    cell: (row) => (
      <span className="font-mono text-sm">${row.price.toFixed(2)}</span>
    ),
  },
  {
    header: "Stock",
    cell: (row) => (
      <Badge variant={getStockVariant(row.stock)}>{row.stock} unidades</Badge>
    ),
  },
  {
    header: "Usos",
    cell: (row) => <Badge variant="outline">{row._count.workParts}</Badge>,
  },
];

export default function PartsPage() {
  const router = useRouter();
  const [parts, setParts] = useState<Part[]>([]);
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
      const result = await getParts({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setParts(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Error al cargar partes:", error);
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

  const actions: CatalogAction<Part>[] = [
    {
      icon: Eye,
      label: "Ver",
      href: (row) => `/admin/parts/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/parts/${row.id}/edit`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar parte",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar "${row.name}"? Esta acción no se puede deshacer.`,
      disabled: (row) => row._count.workParts > 0,
      onClick: async (row) => {
        try {
          const result = await deletePart(row.id);
          if (isFailure(result)) {
            toast.error(result.error);
            return;
          }
          await fetchData();
        } catch (error) {
          console.error("deletePart failed:", error);
          toast.error("No se pudo completar la operación. Intenta de nuevo.");
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Partes e Inventario</h1>
          <p className="text-muted-foreground">
            Administre las partes y el inventario del sistema
          </p>
        </div>
        <Button onClick={() => router.push("/admin/parts/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar Parte
        </Button>
      </div>

      <CatalogTable
        data={parts}
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
        emptyMessage="Sin partes registradas."
      />
    </div>
  );
}
