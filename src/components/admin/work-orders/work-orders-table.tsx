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
import { Edit, Trash2, Eye, Wrench } from "lucide-react";
import Link from "next/link";
import { deleteWorkOrder } from "@/lib/actions/work-orders";
import { useRouter } from "next/navigation";
import { useState } from "react";

type WorkOrder = {
  id: string;
  status: {
    id: number;
    name: string;
    active: boolean;
  } | null;
  notes: string | null;
  createdAt: Date;
  incident: {
    title: string;
    priority: number;
  };
  assignedTo: {
    name: string;
  };
  _count: {
    workActivities: number;
    workParts: number;
  };
};

export function WorkOrdersTable({ workOrders }: { workOrders: WorkOrder[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Esta seguro de que desea eliminar la orden de trabajo?`)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteWorkOrder(id);
      router.refresh();
    } catch (error) {
      alert("Error al eliminar orden de trabajo: " + (error as Error).message);
      setDeleting(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETADO":
        return "default";
      case "EN_PROGRESO":
        return "secondary";
      case "PENDIENTE":
        return "outline";
      default:
        return "outline";
    }
  };

  if (workOrders.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No hay ordenes de trabajo registradas</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Incidente</TableHead>
            <TableHead>Asignado A</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Actividades</TableHead>
            <TableHead>Partes</TableHead>
            <TableHead>Fecha Creacion</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders.map((wo) => (
            <TableRow key={wo.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="max-w-xs truncate">{wo.incident.title}</span>
                </div>
              </TableCell>
              <TableCell>{wo.assignedTo.name}</TableCell>
              <TableCell>
                <Badge variant={getStatusColor(wo.status?.name || '')}>{wo.status?.name || 'N/A'}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{wo._count.workActivities}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{wo._count.workParts}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(wo.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/work-orders/${wo.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/work-orders/${wo.id}/edit`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(wo.id, wo.incident.title)}
                    disabled={deleting === wo.id}
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
