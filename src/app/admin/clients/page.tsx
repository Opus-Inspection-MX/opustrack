"use client";

import { Building2, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  CatalogAction,
  CatalogColumn,
} from "@/components/common/catalog-table";
import { CatalogTable } from "@/components/common/catalog-table";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/hooks/use-toast";
import { deleteClient, getClients } from "@/lib/actions/clients";
import { isFailure } from "@/lib/actions/result";
import { logger } from "@/lib/observability/logger";

type ClientRow = Awaited<ReturnType<typeof getClients>>["data"][number];

const totalEquipments = (row: ClientRow) =>
  row.lines?.reduce((sum, line) => sum + line._count.equipments, 0) ?? 0;

const columns: CatalogColumn<ClientRow>[] = [
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

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
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
      const result = await getClients({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setClients(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      logger.error("Error al cargar centros:", error);
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

  const actions: CatalogAction<ClientRow>[] = [
    {
      icon: Eye,
      label: "Ver detalles",
      href: (row) => `/admin/clients/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/clients/${row.id}/edit`,
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
          const result = await deleteClient(row.id);
          if (isFailure(result)) {
            toast.error(result.error);
            return;
          }
          await fetchData();
        } catch (error) {
          logger.error("deleteClient failed:", error);
          toast.error("No se pudo completar la operación. Intenta de nuevo.");
        }
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Centros de Verificación"
        description="Administre los centros de verificación vehicular"
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/clients/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Agregar Cliente
            </Link>
          </Button>
        }
      />

      <CatalogTable
        data={clients}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
        mobileCard={(row) => (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <p className="font-medium">
              {row.name} ({row.code})
            </p>
            <p className="text-xs text-muted-foreground">
              {row.state.name} · {row._count.lines} líneas ·{" "}
              {row._count.incidents} incidentes
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/clients/${row.id}`}>Ver detalles</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/clients/${row.id}/edit`}>Editar</Link>
              </Button>
            </div>
          </div>
        )}
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
    </PageContainer>
  );
}
