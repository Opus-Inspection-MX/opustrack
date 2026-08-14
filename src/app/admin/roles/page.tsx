"use client";

import { Eye, Pencil, Plus, Shield, Trash2 } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { deleteRole, getRoles } from "@/lib/actions/roles";

type RoleRow = Awaited<ReturnType<typeof getRoles>>["data"][number];

const columns: CatalogColumn<RoleRow>[] = [
  {
    header: "Nombre",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary shrink-0" />
        <span className="font-medium">{row.name}</span>
      </div>
    ),
  },
  {
    header: "Descripción",
    cell: (row) =>
      row.description ? (
        <span className="text-sm truncate max-w-xs block">
          {row.description}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Sin descripción</span>
      ),
  },
  {
    header: "Ruta Predeterminada",
    cell: (row) => (
      <code className="text-sm bg-muted px-2 py-1 rounded">
        {row.defaultPath}
      </code>
    ),
  },
  {
    header: "Permisos",
    cell: (row) => (
      <Badge variant="secondary">{row.rolePermission.length} permisos</Badge>
    ),
  },
  {
    header: "Usuarios",
    cell: (row) => (
      <Badge variant="outline">{row._count.userRoles} usuarios</Badge>
    ),
  },
];

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
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
      const result = await getRoles({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setRoles(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Error al cargar roles:", error);
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

  const actions: CatalogAction<RoleRow>[] = [
    {
      icon: Eye,
      label: "Ver",
      href: (row) => `/admin/roles/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/roles/${row.id}/edit`,
    },
    {
      icon: Shield,
      label: "Permisos",
      href: (row) => `/admin/roles/${row.id}/permissions`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar rol",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar el rol "${row.name}"? Esta acción no se puede deshacer.`,
      disabled: (row) => row._count.userRoles > 0,
      onClick: async (row) => {
        try {
          const result = await deleteRole(row.id);
          if (isFailure(result)) {
            toast.error(result.error);
            return;
          }
          await fetchData();
        } catch (error) {
          console.error("deleteRole failed:", error);
          toast.error("No se pudo completar la operación. Intenta de nuevo.");
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground">
            Administre los roles del sistema y sus permisos
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/roles/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Rol
          </Link>
        </Button>
      </div>

      <CatalogTable
        data={roles}
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
        emptyMessage="Sin roles registrados."
      />
    </div>
  );
}
