import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "open"
  | "progress"
  | "done"
  | "cancelled"
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "neutral";

const toneClass: Record<StatusTone, string> = {
  open: "border-transparent bg-status-open-muted text-status-open",
  progress: "border-transparent bg-status-progress-muted text-status-progress",
  done: "border-transparent bg-status-done-muted text-status-done",
  cancelled:
    "border-transparent bg-status-cancelled-muted text-status-cancelled",
  success: "border-transparent bg-success-muted text-success-muted-foreground",
  warning: "border-transparent bg-warning-muted text-warning-muted-foreground",
  info: "border-transparent bg-info-muted text-info-muted-foreground",
  danger: "border-transparent bg-danger-muted text-danger-muted-foreground",
  neutral: "border-transparent bg-muted text-muted-foreground",
};

interface StatusBadgeProps {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}

/**
 * Single badge for incident/assignment statuses.
 *
 * Colors come from the `--status-*` / semantic tokens, so the three themes
 * stay in sync. Replaces the scattered `getStatusColor` / `getStatusBadge`
 * helpers (their migration to this component happens per area in Fase 4).
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: StatusBadgeProps) {
  return <Badge className={cn(toneClass[tone], className)}>{children}</Badge>;
}
