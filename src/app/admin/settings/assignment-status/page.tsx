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
import { SystemBadge } from "@/components/common/system-badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/hooks/use-toast";
import {
  deleteAssignmentStatus,
  getAssignmentStatuses,
} from "@/lib/actions/lookups";
import { isFailure } from "@/lib/actions/result";
import { logger } from "@/lib/observability/logger";

type AssignmentStatus = Awaited<
  ReturnType<typeof getAssignmentStatuses>
>["data"][number];

const columns: CatalogColumn<AssignmentStatus>[] = [
  {
    header: "ID",
    cell: (row) => <span className="font-mono text-sm">{row.id}</span>,
  },
  {
    header: "Nombre",
    cell: (row) => (
      <span className="flex items-center gap-2 font-medium">
        {row.name}
        <SystemBadge code={row.code} />
      </span>
    ),
  },
  {
    header: "Órdenes",
    cell: (row) => row._count.assignments,
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

export default function AssignmentStatusPage() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<AssignmentStatus[]>([]);
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
      const result = await getAssignmentStatuses({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setStatuses(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      logger.error("Error fetching asignación statuses:", error);
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

  const actions: CatalogAction<AssignmentStatus>[] = [
    {
      icon: Eye,
      label: "Ver",
      href: (row) => `/admin/settings/assignment-status/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/settings/assignment-status/${row.id}/edit`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar estado de asignación",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar "${row.name}"? Esta acción no se puede deshacer.`,
      disabled: (row) => row._count.assignments > 0,
      onClick: async (row) => {
        try {
          const result = await deleteAssignmentStatus(row.id);
          if (isFailure(result)) {
            toast.error(result.error);
            return;
          }
          await fetchData();
        } catch (error) {
          logger.error("deleteAssignmentStatus failed:", error);
          toast.error("No se pudo completar la operación. Intenta de nuevo.");
        }
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Estado de Asignación"
        description="Gestionar tipos de estado de asignación"
        actions={
          <Button
            onClick={() => router.push("/admin/settings/assignment-status/new")}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Nuevo Estado
          </Button>
        }
      />

      {/* RF-656: State machine warning banner — must remain visible above the table */}
      <div className="rounded-md border border-warning/40 bg-warning-muted/40 px-4 py-3 text-sm">
        <p className="font-medium text-warning-muted-foreground">Aviso</p>
        <p className="text-muted-foreground mt-1">
          Estos estados están vinculados al state machine de asignaciones. Los
          estados <code className="text-xs">PENDIENTE_DE_ASIGNACION</code>,{" "}
          <code className="text-xs">ASIGNADO</code>,{" "}
          <code className="text-xs">VISTO</code>,{" "}
          <code className="text-xs">INICIADO</code>,{" "}
          <code className="text-xs">EN_PROGRESO</code> y{" "}
          <code className="text-xs">CERRADO</code> son referenciados por nombre.
          Renombrar o eliminar uno puede romper el flujo. Consulta el{" "}
          <a
            href="/admin/lifecycle"
            className="underline text-warning-muted-foreground"
          >
            Ciclo de Vida
          </a>{" "}
          antes de modificar.
        </p>
      </div>

      <CatalogTable
        data={statuses}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
        mobileCard={(row) => (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{row.name}</p>
              <StatusBadge tone={row.active ? "success" : "neutral"}>
                {row.active ? "Activo" : "Inactivo"}
              </StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">
              {row._count.assignments} órdenes
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/settings/assignment-status/${row.id}`}>
                  Ver
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/admin/settings/assignment-status/${row.id}/edit`}>
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
        emptyMessage="Sin estados de asignación."
      />
    </PageContainer>
  );
}
