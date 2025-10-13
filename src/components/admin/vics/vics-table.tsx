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
import { deleteVIC } from "@/lib/actions/vics";
import { useRouter } from "next/navigation";
import { useState } from "react";

type VIC = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  lines: number;
  state: {
    name: string;
  };
  _count: {
    users: number;
    incidents: number;
    Part: number;
  };
};

export function VICsTable({ vics }: { vics: VIC[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de que desea eliminar el VIC "${name}"?`)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteVIC(id);
      router.refresh();
    } catch (error) {
      alert("Error al eliminar VIC: " + (error as Error).message);
      setDeleting(null);
    }
  };

  if (vics.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No hay centros de verificación registrados</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Líneas</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Usuarios</TableHead>
            <TableHead>Incidentes</TableHead>
            <TableHead>Partes</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vics.map((vic) => (
            <TableRow key={vic.id}>
              <TableCell className="font-medium">{vic.code}</TableCell>
              <TableCell>{vic.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{vic.state.name}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{vic.lines}</Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {vic.phone && <div>{vic.phone}</div>}
                  {vic.email && (
                    <div className="text-muted-foreground">{vic.email}</div>
                  )}
                  {!vic.phone && !vic.email && (
                    <span className="text-muted-foreground">Sin contacto</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{vic._count.users}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{vic._count.incidents}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{vic._count.Part}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/vic-centers/${vic.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/vic-centers/${vic.id}/edit`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(vic.id, vic.name)}
                    disabled={deleting === vic.id}
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
