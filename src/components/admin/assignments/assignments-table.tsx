"use client";

import { CheckCircle, Edit, Eye, Lock, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { ResponsiveTable } from "@/components/common/responsive-table";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { deleteAssignment } from "@/lib/actions/assignments";
import { isFailure } from "@/lib/actions/result";
import { logger } from "@/lib/observability/logger";
import { formatMX } from "@/lib/utils/datetime";

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

function statusTone(status: string): StatusTone {
  switch (status) {
    case "ASIGNADO":
      return "open";
    case "VISTO":
      return "info";
    case "INICIADO":
    case "EN_PROGRESO":
      return "progress";
    case "CERRADO":
      return "done";
    case "CANCELADA":
      return "cancelled";
    default:
      return "neutral";
  }
}

function UnlockCell({ assignment }: { assignment: Assignment }) {
  if (assignment.seenAt) {
    return (
      <div className="flex flex-col gap-1">
        <StatusBadge tone="success">
          <CheckCircle className="h-3 w-3 mr-1" aria-hidden />
          Desbloqueado
        </StatusBadge>
        <span className="text-xs text-muted-foreground">
          {formatMX(assignment.seenAt, { dateStyle: "short" })}
        </span>
        {assignment.assignedAt && (
          <span className="text-xs text-muted-foreground">
            TTU:{" "}
            {formatTimeDifference(assignment.assignedAt, assignment.seenAt)}
          </span>
        )}
      </div>
    );
  }
  return (
    <StatusBadge tone="warning">
      <Lock className="h-3 w-3 mr-1" aria-hidden />
      Pendiente
    </StatusBadge>
  );
}

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
      logger.error("deleteAssignment failed:", error);
      toast.error("Error al eliminar asignación");
    } finally {
      setDeleting(null);
    }
  };

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title="Sin asignaciones"
        description="No hay asignaciones registradas"
      />
    );
  }

  return (
    <ResponsiveTable
      data={assignments}
      rowKey={(wo) => wo.id}
      columns={[
        {
          header: "Incidente",
          cell: (wo) => (
            <div className="flex items-center gap-2 font-medium">
              <Wrench className="h-4 w-4 text-primary" aria-hidden />
              <span className="max-w-xs truncate">{wo.incident.title}</span>
            </div>
          ),
        },
        {
          header: "Asignado A",
          cell: (wo) => (
            <span className="text-sm">
              {wo.assignees.map((a) => a.user.name).join(", ") || "Sin asignar"}
            </span>
          ),
        },
        {
          header: "Estado",
          cell: (wo) => (
            <StatusBadge tone={statusTone(wo.status?.name ?? "")}>
              {wo.status?.name || "N/A"}
            </StatusBadge>
          ),
        },
        {
          header: "Desbloqueo",
          cell: (wo) => <UnlockCell assignment={wo} />,
        },
        {
          header: "Actividades",
          cell: (wo) => (
            <Badge variant="outline">{wo._count.assignmentActivities}</Badge>
          ),
        },
        {
          header: "Fecha Creacion",
          cell: (wo) => (
            <span className="text-sm text-muted-foreground">
              {formatMX(wo.createdAt, { dateStyle: "short" })}
            </span>
          ),
        },
        {
          header: "Acciones",
          headerClassName: "text-right",
          className: "text-right",
          cell: (wo) => (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="icon" asChild aria-label="Ver">
                <Link href={`/admin/assignments/${wo.id}`}>
                  <Eye className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild aria-label="Editar">
                <Link href={`/admin/assignments/${wo.id}/edit`}>
                  <Edit className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Eliminar"
                onClick={() => handleDelete(wo.id, wo.incident.title)}
                disabled={deleting === wo.id}
              >
                <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
              </Button>
            </div>
          ),
        },
      ]}
      mobileCard={(wo) => (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone(wo.status?.name ?? "")}>
              {wo.status?.name || "N/A"}
            </StatusBadge>
            <UnlockCell assignment={wo} />
          </div>
          <p className="font-medium">{wo.incident.title}</p>
          <p className="text-xs text-muted-foreground">
            {wo.assignees.map((a) => a.user.name).join(", ") || "Sin asignar"} ·{" "}
            {wo._count.assignmentActivities} actividades
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href={`/admin/assignments/${wo.id}`}>Ver</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href={`/admin/assignments/${wo.id}/edit`}>Editar</Link>
            </Button>
          </div>
        </div>
      )}
      emptyTitle="Sin asignaciones"
      emptyMessage="No hay asignaciones registradas"
    />
  );
}
