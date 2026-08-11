"use client";

import { Edit, Eye, MoreHorizontal, Package, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { toast } from "@/hooks/use-toast";
import { deletePart } from "@/lib/actions/parts";

type Part = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  _count: {
    workParts: number;
  };
};

export function PartsTable({ parts }: { parts: Part[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    const confirmText = `Esta seguro de que desea eliminar la parte ${name}?`;
    if (!confirm(confirmText)) {
      return;
    }

    setDeleting(id);
    try {
      await deletePart(id);
      router.refresh();
    } catch (error) {
      toast.error("Error al eliminar parte");
      setDeleting(null);
    }
  };

  const getStockColor = (stock: number) => {
    if (stock === 0) return "destructive";
    if (stock < 10) return "default";
    return "secondary";
  };

  if (parts.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No hay partes registradas</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripcion</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Usos</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parts.map((part) => (
            <TableRow key={part.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  {part.name}
                </div>
              </TableCell>
              <TableCell>
                {part.description ? (
                  <span className="max-w-xs truncate block">
                    {part.description}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    Sin descripcion
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className="font-mono">${part.price.toFixed(2)}</span>
              </TableCell>
              <TableCell>
                <Badge variant={getStockColor(part.stock)}>
                  {part.stock} unidades
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{part._count.workParts}</Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Abrir menú</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/parts/${part.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/parts/${part.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(part.id, part.name)}
                      disabled={deleting === part.id}
                      className="text-destructive"
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
  );
}
