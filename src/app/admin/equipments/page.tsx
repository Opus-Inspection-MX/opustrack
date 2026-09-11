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
import { deleteEquipment, getEquipments } from "@/lib/actions/equipments";
import { isFailure } from "@/lib/actions/result";
import { logger } from "@/lib/observability/logger";

type Equipment = Awaited<ReturnType<typeof getEquipments>>["data"][number];

const columns: CatalogColumn<Equipment>[] = [
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
    header: "Línea",
    cell: (row) => <span className="text-sm">{row.line?.name ?? "—"}</span>,
  },
  {
    header: "Cliente",
    cell: (row) => (
      <span className="text-sm">{row.line?.client?.name ?? "—"}</span>
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

export default function EquipmentsPage() {
  const router = useRouter();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
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
      const result = await getEquipments({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setEquipments(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      logger.error("Error fetching equipments:", error);
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

  const actions: CatalogAction<Equipment>[] = [
    {
      icon: Eye,
      label: "Ver",
      href: (row) => `/admin/equipments/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/equipments/${row.id}/edit`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar equipo",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar "${row.name}"? Esta acción no se puede deshacer.`,
      onClick: async (row) => {
        try {
          const result = await deleteEquipment(row.id);
          if (isFailure(result)) {
            toast.error(result.error);
            return;
          }
          await fetchData();
        } catch (error) {
          logger.error("deleteEquipment failed:", error);
          toast.error("No se pudo completar la operación. Intenta de nuevo.");
        }
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Equipos"
        description="Gestiona los equipos de las líneas"
        actions={
          <Button
            onClick={() => router.push("/admin/equipments/new")}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Nuevo Equipo
          </Button>
        }
      />

      <CatalogTable
        data={equipments}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
        mobileCard={(row) => (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.line?.name ?? "—"} · {row.line?.client?.name ?? "—"}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/equipments/${row.id}`}>Ver</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/equipments/${row.id}/edit`}>Editar</Link>
              </Button>
            </div>
          </div>
        )}
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
        emptyMessage="Sin equipos registrados."
      />
    </PageContainer>
  );
}
