"use client";

import { Building2, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  CatalogAction,
  CatalogColumn,
} from "@/components/common/catalog-table";
import { CatalogTable } from "@/components/common/catalog-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { deleteCliente, getClientes } from "@/lib/actions/clientes";

type ClienteRow = Awaited<ReturnType<typeof getClientes>>["data"][number];

const totalEquipments = (row: ClienteRow) =>
  row.lines?.reduce((sum, line) => sum + line._count.equipments, 0) ?? 0;

const columns: CatalogColumn<ClienteRow>[] = [
  {
    header: "Código",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <span className="font-medium">{row.code}</span>
      </div>
    ),
  },
  {
    header: "Nombre",
    cell: (row) => <span>{row.name}</span>,
  },
  {
    header: "Estado",
    cell: (row) => <Badge variant="outline">{row.state.name}</Badge>,
  },
  {
    header: "Contacto",
    cell: (row) => (
      <div className="text-sm">
        {row.phone && <div>{row.phone}</div>}
        {row.email && <div className="text-muted-foreground">{row.email}</div>}
        {!row.phone && !row.email && (
          <span className="text-muted-foreground">Sin contacto</span>
        )}
      </div>
    ),
  },
  {
    header: "FSRs",
    cell: (row) => <Badge variant="outline">{row.fsrCount}</Badge>,
  },
  {
    header: "Usuarios",
    cell: (row) => <Badge variant="outline">{row._count.users}</Badge>,
  },
  {
    header: "Incidentes",
    cell: (row) => <Badge variant="outline">{row._count.incidents}</Badge>,
  },
  {
    header: "Líneas",
    cell: (row) => <Badge variant="outline">{row._count.lines}</Badge>,
  },
  {
    header: "Equipos",
    cell: (row) => <Badge variant="outline">{totalEquipments(row)}</Badge>,
  },
];

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
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
      const result = await getClientes({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setClientes(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Error al cargar centros:", error);
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

  const actions: CatalogAction<ClienteRow>[] = [
    {
      icon: Eye,
      label: "Ver detalles",
      href: (row) => `/admin/clientes/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/clientes/${row.id}/edit`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar centro",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar el centro "${row.name}"? Esta acción no se puede deshacer.`,
      onClick: async (row) => {
        try {
          await deleteCliente(row.id);
          await fetchData();
        } catch (error) {
          console.error("Error al eliminar centro:", error);
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Centros de Verificación</h1>
          <p className="text-muted-foreground">
            Administre los centros de verificación vehicular
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/clientes/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Cliente
          </Link>
        </Button>
      </div>

      <CatalogTable
        data={clientes}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Buscar por código, nombre o razón social..."
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
        emptyMessage="Sin centros de verificación registrados."
      />
    </div>
  );
}
