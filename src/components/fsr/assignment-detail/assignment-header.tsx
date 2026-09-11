import { Lock } from "lucide-react";
import { BackButton } from "@/components/common/back-button";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";

export function assignmentStatusTone(status: string): StatusTone {
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

interface AssignmentHeaderProps {
  incidentTitle: string;
  statusName: string;
  incidentLocked: boolean;
  incidentStatus: string;
  assignmentClosed: boolean;
}

/**
 * Detail heading for the FSR assignment page.
 * Single h1 is rendered by PageHeader; this block keeps the back button,
 * the assignment status and the parent-incident lock badge.
 */
export function AssignmentHeader({
  statusName,
  incidentLocked,
  incidentStatus,
  assignmentClosed,
}: AssignmentHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <BackButton fallback="/fsr/assignments" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={assignmentStatusTone(statusName)}>
            {statusName || "N/A"}
          </StatusBadge>
          {assignmentClosed && !incidentLocked && (
            <StatusBadge tone="done">Cerrada</StatusBadge>
          )}
          {incidentLocked && (
            <StatusBadge
              tone={incidentStatus === "CANCELADA" ? "cancelled" : "done"}
            >
              <Lock className="mr-1 h-3 w-3" aria-hidden />
              Incidencia{" "}
              {incidentStatus === "CANCELADA" ? "cancelada" : "cerrada"}
            </StatusBadge>
          )}
        </div>
      </div>
    </div>
  );
}
