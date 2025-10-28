"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit, Trash2, Shield, Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { deleteRole } from "@/lib/actions/roles";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TablePagination } from "@/components/common/table-pagination";

type Role = {
  id: number;
  name: string;
  description: string | null;
  defaultPath: string;
  rolePermission: Array<{
    permission: {
      id: number;
      name: string;
    };
  }>;
  _count: {
    users: number;
  };
};

export function RolesTable({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = roles.slice(startIndex, endIndex);
  const totalPages = Math.ceil(roles.length / itemsPerPage);

  const handleDelete = async (id: number, name: string) => {
    const confirmText = `Esta seguro de que desea eliminar el rol ${name}?`;
    if (!confirm(confirmText)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteRole(id);
      router.refresh();
    } catch (error) {
      alert("Error al eliminar rol: " + (error as Error).message);
      setDeleting(null);
    }
  };

  if (roles.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No hay roles registrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden lg:table-cell">Descripcion</TableHead>
              <TableHead className="hidden md:table-cell">Ruta Predeterminada</TableHead>
              <TableHead className="hidden sm:table-cell">Permisos</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead className="w-[70px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="truncate">{role.name}</span>
                  </div>
                  <div className="sm:hidden flex flex-wrap gap-1 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {role.rolePermission.length} permisos
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="max-w-xs truncate">
                  {role.description || (
                    <span className="text-muted-foreground text-sm">
                      Sin descripcion
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {role.defaultPath}
                </code>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="secondary">
                  {role.rolePermission.length} permisos
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{role._count.users} usuarios</Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/roles/${role.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/roles/${role.id}/permissions`}>
                        <Shield className="mr-2 h-4 w-4" />
                        Permisos
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/roles/${role.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(role.id, role.name)}
                      disabled={deleting === role.id}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={roles.length}
        startIndex={startIndex}
        endIndex={Math.min(endIndex, roles.length)}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />
    </div>
  );
}
