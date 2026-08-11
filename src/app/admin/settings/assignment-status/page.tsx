"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type {
  CatalogAction,
  CatalogColumn,
} from "@/components/common/catalog-table";
import { CatalogTable } from "@/components/common/catalog-table";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/hooks/use-toast";
import {
  deleteAssignmentStatus,
  getAssignmentStatuses,
} from "@/lib/actions/lookups";
import { isFailure } from "@/lib/actions/result";

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
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    header: "Órdenes",
    cell: (row) => row._count.assignments,
  },
  {
    header: "Estado",
    cell: (row) => (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.active
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
        }`}
      >
        {row.active ? "Activo" : "Inactivo"}
      </span>
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
      console.error("Error fetching asignación statuses:", error);
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
          console.error("deleteAssignmentStatus failed:", error);
          toast.error("No se pudo completar la operación. Intenta de nuevo.");
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Estado de Asignación</h1>
          <p className="text-muted-foreground">
            Gestionar tipos de estado de asignación
          </p>
        </div>
        <Button
          onClick={() => router.push("/admin/settings/assignment-status/new")}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Estado
        </Button>
      </div>

      {/* RF-656: State machine warning banner — must remain visible above the table */}
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-300">Aviso</p>
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
            className="underline text-amber-700 dark:text-amber-300"
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
    </div>
  );
}
