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
import { Edit, Trash2, Eye, Package } from "lucide-react";
import Link from "next/link";
import { deletePart } from "@/lib/actions/parts";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Part = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  vic: {
    name: string;
    code: string;
  };
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
      alert("Error al eliminar parte: " + (error as Error).message);
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
            <TableHead>VIC</TableHead>
            <TableHead>Usos</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
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
                  <span className="max-w-xs truncate block">{part.description}</span>
                ) : (
                  <span className="text-muted-foreground text-sm">Sin descripcion</span>
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
                <span className="text-sm">{part.vic.name}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{part._count.workParts}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/parts/${part.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/parts/${part.id}/edit`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(part.id, part.name)}
                    disabled={deleting === part.id}
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
