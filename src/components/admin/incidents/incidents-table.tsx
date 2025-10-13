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
import { Edit, Trash2, Eye, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { deleteIncident } from "@/lib/actions/incidents";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Incident = {
  id: number;
  title: string;
  description: string;
  priority: number;
  sla: number;
  reportedAt: Date;
  type: {
    name: string;
  } | null;
  status: {
    name: string;
  } | null;
  vic: {
    name: string;
    code: string;
  } | null;
  reportedBy: {
    name: string;
  } | null;
  _count: {
    workOrders: number;
  };
};

export function IncidentsTable({ incidents }: { incidents: Incident[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Esta seguro de que desea eliminar el incidente "${title}"?`)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteIncident(id);
      router.refresh();
    } catch (error) {
      alert("Error al eliminar incidente: " + (error as Error).message);
      setDeleting(null);
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "destructive";
    if (priority >= 5) return "default";
    return "secondary";
  };

  if (incidents.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No hay incidentes registrados</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titulo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>VIC</TableHead>
            <TableHead>Reportado Por</TableHead>
            <TableHead>Ordenes</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => (
            <TableRow key={incident.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {incident.priority >= 8 && (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="max-w-xs truncate">{incident.title}</span>
                </div>
              </TableCell>
              <TableCell>
                {incident.type ? (
                  <Badge variant="outline">{incident.type.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">Sin tipo</span>
                )}
              </TableCell>
              <TableCell>
                {incident.status ? (
                  <Badge variant="secondary">{incident.status.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">Sin estado</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={getPriorityColor(incident.priority)}>
                  {incident.priority}/10
                </Badge>
              </TableCell>
              <TableCell>
                {incident.vic ? (
                  <span className="text-sm">
                    {incident.vic.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">Sin VIC</span>
                )}
              </TableCell>
              <TableCell>
                {incident.reportedBy ? (
                  <span className="text-sm">{incident.reportedBy.name}</span>
                ) : (
                  <span className="text-muted-foreground text-sm">Desconocido</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{incident._count.workOrders}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(incident.reportedAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/incidents/${incident.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/incidents/${incident.id}/edit`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(incident.id, incident.title)}
                    disabled={deleting === incident.id}
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
