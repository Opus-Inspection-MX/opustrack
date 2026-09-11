import { CheckCircle, Eye, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JobActionsProps {
  isAssigned: boolean;
  isSeen: boolean;
  isStarted: boolean;
  isInProgress: boolean;
  actionLoading: boolean;
  closeDisabled: boolean;
  closeDisabledReason?: string;
  onMarkSeen: () => void;
  onStartWork: () => void;
  onPauseWork: () => void;
  onResumeWork: () => void;
  onCloseWork: () => void;
  className?: string;
}

/**
 * State-machine actions for one assignment.
 * Rendered inline on desktop and inside a sticky bottom bar on mobile.
 * Button labels are part of the e2e contract — do not rename them.
 */
export function JobActions({
  isAssigned,
  isSeen,
  isStarted,
  isInProgress,
  actionLoading,
  closeDisabled,
  closeDisabledReason,
  onMarkSeen,
  onStartWork,
  onPauseWork,
  onResumeWork,
  onCloseWork,
  className,
}: JobActionsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {isAssigned && (
        <Button
          onClick={onMarkSeen}
          disabled={actionLoading}
          className="min-h-[44px]"
        >
          <Eye className="mr-2 h-4 w-4" aria-hidden />
          Marcar como visto
        </Button>
      )}
      {isSeen && (
        <Button
          onClick={onStartWork}
          disabled={actionLoading}
          variant="secondary"
          className="min-h-[44px]"
        >
          <Play className="mr-2 h-4 w-4" aria-hidden />
          Iniciar trabajo
        </Button>
      )}
      {isStarted && (
        <>
          <Button
            onClick={onPauseWork}
            disabled={actionLoading}
            variant="outline"
            className="min-h-[44px]"
          >
            <Pause className="mr-2 h-4 w-4" aria-hidden />
            Pausar (En progreso)
          </Button>
          <Button
            onClick={onCloseWork}
            disabled={closeDisabled}
            title={closeDisabledReason}
            className="min-h-[44px]"
          >
            <CheckCircle className="mr-2 h-4 w-4" aria-hidden />
            Cerrar trabajo
          </Button>
        </>
      )}
      {isInProgress && (
        <>
          <Button
            onClick={onResumeWork}
            disabled={actionLoading}
            variant="secondary"
            className="min-h-[44px]"
          >
            <Play className="mr-2 h-4 w-4" aria-hidden />
            Retomar
          </Button>
          <Button
            onClick={onCloseWork}
            disabled={closeDisabled}
            title={closeDisabledReason}
            className="min-h-[44px]"
          >
            <CheckCircle className="mr-2 h-4 w-4" aria-hidden />
            Cerrar trabajo
          </Button>
        </>
      )}
    </div>
  );
}
