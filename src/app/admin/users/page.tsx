"use client";

import { Eye, Pencil, Plus, Trash2, User } from "lucide-react";
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
import { deleteUser, getUsers } from "@/lib/actions/users";

type UserRow = Awaited<ReturnType<typeof getUsers>>["data"][number];

const columns: CatalogColumn<UserRow>[] = [
  {
    header: "Nombre",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-primary shrink-0" />
        <span className="font-medium">{row.name}</span>
      </div>
    ),
  },
  {
    header: "Email",
    cell: (row) => (
      <span className="text-sm text-muted-foreground">{row.email}</span>
    ),
  },
  {
    header: "Rol",
    cell: (row) => <Badge variant="outline">{row.role.name}</Badge>,
  },
  {
    header: "Estado",
    cell: (row) => (
      <Badge
        variant={row.userStatus.name === "ACTIVO" ? "default" : "secondary"}
      >
        {row.userStatus.name}
      </Badge>
    ),
  },
  {
    header: "Cliente",
    cell: (row) =>
      row.cliente ? (
        <span className="text-sm">
          {row.cliente.name} ({row.cliente.code})
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Sin asignar</span>
      ),
  },
  {
    header: "Activo",
    cell: (row) => (
      <Badge variant={row.active ? "default" : "destructive"}>
        {row.active ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
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
      const result = await getUsers({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      });
      setUsers(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
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

  const actions: CatalogAction<UserRow>[] = [
    {
      icon: Eye,
      label: "Ver",
      href: (row) => `/admin/users/${row.id}`,
    },
    {
      icon: Pencil,
      label: "Editar",
      href: (row) => `/admin/users/${row.id}/edit`,
    },
    {
      icon: Trash2,
      label: "Eliminar",
      variant: "destructive",
      requiresConfirm: true,
      confirmTitle: "Eliminar usuario",
      confirmMessage: (row) =>
        `¿Seguro que deseas eliminar al usuario "${row.name}"? Esta acción no se puede deshacer.`,
      onClick: async (row) => {
        try {
          await deleteUser(row.id);
          await fetchData();
        } catch (error) {
          console.error("Error al eliminar usuario:", error);
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground">
            Administre los usuarios del sistema y sus permisos
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Usuario
          </Link>
        </Button>
      </div>

      <CatalogTable
        data={users}
        columns={columns}
        actions={actions}
        rowKey={(row) => row.id}
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Buscar por nombre, email o ID..."
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
        emptyMessage="Sin usuarios registrados."
      />
    </div>
  );
}
