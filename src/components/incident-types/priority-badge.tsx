import { Badge } from "@/components/ui/badge";
import { CRITICAL_PRIORITY_THRESHOLD } from "@/lib/constants/incident-type";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: number;
  className?: string;
}

/**
 * Displays an IncidentType priority value (1–10) with a severity color.
 *
 * Color mapping:
 *  8–10  → destructive (critical)
 *  5–7   → amber (medium)
 *  1–4   → muted (low)
 */
export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const colorClass =
    priority >= CRITICAL_PRIORITY_THRESHOLD
      ? "bg-destructive text-white border-transparent"
      : priority >= 5
        ? "bg-amber-500 text-white border-transparent"
        : "bg-muted text-muted-foreground border-transparent";

  return <Badge className={cn(colorClass, className)}>{priority}</Badge>;
}
