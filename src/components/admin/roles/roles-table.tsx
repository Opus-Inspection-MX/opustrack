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
import { Edit, Trash2, Shield, Eye } from "lucide-react";
import Link from "next/link";
import { deleteRole } from "@/lib/actions/roles";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripcion</TableHead>
            <TableHead>Ruta Predeterminada</TableHead>
            <TableHead>Permisos</TableHead>
            <TableHead>Usuarios</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  {role.name}
                </div>
              </TableCell>
              <TableCell>
                {role.description || (
                  <span className="text-muted-foreground text-sm">
                    Sin descripcion
                  </span>
                )}
              </TableCell>
              <TableCell>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {role.defaultPath}
                </code>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {role.rolePermission.length} permisos
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{role._count.users} usuarios</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/roles/${role.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/roles/${role.id}/permissions`}>
                      <Shield className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/roles/${role.id}/edit`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(role.id, role.name)}
                    disabled={deleting === role.id}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
