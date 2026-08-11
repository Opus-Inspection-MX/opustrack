"use client";

import { CheckCircle, Edit, Eye, Lock, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { deleteAssignment } from "@/lib/actions/assignments";
import { isFailure } from "@/lib/actions/result";

type Assignment = {
  id: string;
  status: {
    id: number;
    name: string;
    active: boolean;
  } | null;
  notes: string | null;
  createdAt: Date;
  seenAt: Date | null;
  assignedAt: Date | null;
  incident: {
    title: string;
  };
  assignees: Array<{ user: { name: string } }>;
  _count: {
    assignmentActivities: number;
    workParts: number;
  };
};

// Helper to calculate time-to-unlock
const formatTimeDifference = (start: Date | null, end: Date | null): string => {
  if (!start || !end) return "-";
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
};

export function AssignmentsTable({
  assignments,
}: {
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, _title: string) => {
    if (!confirm(`Esta seguro de que desea eliminar la asignación?`)) {
      return;
    }

    setDeleting(id);
    try {
      const result = await deleteAssignment(id);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    } catch (error) {
      console.error("deleteAssignment failed:", error);
      toast.error("Error al eliminar asignación");
    } finally {
      setDeleting(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CERRADO":
        return "default";
      case "INICIADO":
        return "secondary";
      case "EN_PROGRESO":
      case "VISTO":
      case "ASIGNADO":
      case "PENDIENTE_DE_ASIGNACION":
        return "outline";
      default:
        return "outline";
    }
  };

  if (assignments.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No hay asignaciones registradas</p>
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
            <TableHead>Desbloqueo</TableHead>
            <TableHead>Actividades</TableHead>
            <TableHead>Partes</TableHead>
            <TableHead>Fecha Creacion</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((wo) => (
            <TableRow key={wo.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="max-w-xs truncate">{wo.incident.title}</span>
                </div>
              </TableCell>
              <TableCell>
                {wo.assignees.map((a) => a.user.name).join(", ") ||
                  "Sin asignar"}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusColor(wo.status?.name || "")}>
                  {wo.status?.name || "N/A"}
                </Badge>
              </TableCell>
              <TableCell>
                {wo.seenAt ? (
                  <div className="flex flex-col gap-1">
                    <Badge
                      variant="default"
                      className="bg-green-600 text-xs w-fit"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Desbloqueado
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(wo.seenAt).toLocaleDateString()}
                    </span>
                    {wo.assignedAt && (
                      <span className="text-xs text-muted-foreground">
                        TTU: {formatTimeDifference(wo.assignedAt, wo.seenAt)}
                      </span>
                    )}
                  </div>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-yellow-50 text-yellow-700 border-yellow-300"
                  >
                    <Lock className="h-3 w-3 mr-1" />
                    Pendiente
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {wo._count.assignmentActivities}
                </Badge>
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
                    <Link href={`/admin/assignments/${wo.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/assignments/${wo.id}/edit`}>
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
