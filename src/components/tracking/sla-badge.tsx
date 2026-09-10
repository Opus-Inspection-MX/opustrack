import { Badge } from "@/components/ui/badge";
import type { SlaState } from "@/lib/constants/sla-policy";
import { cn } from "@/lib/utils";

interface SlaBadgeProps {
  state?: SlaState | null;
  className?: string;
}

/**
 * SLA breach flag for a tracking row (RF-218), rendered next to the
 * `PriorityBadge`. Only the actionable states render: on-track and
 * non-applicable rows show no badge at all.
 */
export function SlaBadge({ state, className }: SlaBadgeProps) {
  if (!state || state === "ON_TRACK" || state === "NOT_APPLICABLE") {
    return null;
  }

  const colorClass =
    state === "BREACHED"
      ? "bg-destructive text-white border-transparent"
      : "bg-amber-500 text-white border-transparent";

  return (
    <Badge className={cn(colorClass, className)}>
      {state === "BREACHED" ? "SLA vencido" : "SLA en riesgo"}
    </Badge>
  );
}
