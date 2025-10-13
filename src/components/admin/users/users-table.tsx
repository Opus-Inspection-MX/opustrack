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
import { Edit, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { deleteUser } from "@/lib/actions/users";
import { useRouter } from "next/navigation";
import { useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
  role: {
    name: string;
  };
  userStatus: {
    name: string;
  };
  vic: {
    name: string;
    code: string;
  } | null;
};

export function UsersTable({ users }: { users: User[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de que desea eliminar al usuario "${name}"?`)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteUser(id);
      router.refresh();
    } catch (error) {
      alert("Error al eliminar usuario: " + (error as Error).message);
      setDeleting(null);
    }
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No hay usuarios registrados</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>VIC</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{user.role.name}</Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    user.userStatus.name === "ACTIVO" ? "default" : "secondary"
                  }
                >
                  {user.userStatus.name}
                </Badge>
              </TableCell>
              <TableCell>
                {user.vic ? (
                  <span className="text-sm">
                    {user.vic.name} ({user.vic.code})
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    Sin asignar
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={user.active ? "default" : "destructive"}>
                  {user.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/users/${user.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/users/${user.id}/edit`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(user.id, user.name)}
                    disabled={deleting === user.id}
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
