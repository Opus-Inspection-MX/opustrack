"use client";

import { Edit, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteCliente } from "@/lib/actions/clientes";

type Cliente = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  state: {
    name: string;
  };
  _count: {
    users: number;
    incidents: number;
    lines: number;
  };
  lines?: Array<{
    id: number;
    _count: {
      equipments: number;
    };
  }>;
  fsrCount?: number;
};

export function ClientesTable({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de que desea eliminar el Cliente "${name}"?`)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteCliente(id);
      router.refresh();
    } catch (error) {
      alert(`Error al eliminar Cliente: ${(error as Error).message}`);
      setDeleting(null);
    }
  };

  if (clientes.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">
          No hay centros de verificación registrados
        </p>
      </div>
    );
  }

  // Calculate total equipments
  const getTotalEquipments = (cliente: Cliente) => {
    return (
      cliente.lines?.reduce((sum, line) => sum + line._count.equipments, 0) || 0
    );
  };

  // Calculate total FSRs assigned to this Cliente
  const getTotalFSRs = (cliente: Cliente) => {
    return cliente.fsrCount || 0;
  };

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>FSRs</TableHead>
            <TableHead>Usuarios</TableHead>
            <TableHead>Incidentes</TableHead>
            <TableHead>Líneas</TableHead>
            <TableHead>Equipos</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => (
            <TableRow key={cliente.id}>
              <TableCell className="font-medium">{cliente.code}</TableCell>
              <TableCell>{cliente.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{cliente.state.name}</Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {cliente.phone && <div>{cliente.phone}</div>}
                  {cliente.email && (
                    <div className="text-muted-foreground">{cliente.email}</div>
                  )}
                  {!cliente.phone && !cliente.email && (
                    <span className="text-muted-foreground">Sin contacto</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{getTotalFSRs(cliente)}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{cliente._count.users}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{cliente._count.incidents}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{cliente._count.lines}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{getTotalEquipments(cliente)}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/admin/clientes/${cliente.id}`}
                        className="flex items-center cursor-pointer"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalles
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/admin/clientes/${cliente.id}/edit`}
                        className="flex items-center cursor-pointer"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(cliente.id, cliente.name)}
                      disabled={deleting === cliente.id}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
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
  );
}
