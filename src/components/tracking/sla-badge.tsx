import { SlaBadge as CommonSlaBadge } from "@/components/common/sla-badge";
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
 *
 * Colors come from the shared `--sla-*` tokens via the common SlaBadge.
 */
export function SlaBadge({ state, className }: SlaBadgeProps) {
  if (!state || state === "ON_TRACK" || state === "NOT_APPLICABLE") {
    return null;
  }

  return (
    <CommonSlaBadge
      tone={state === "BREACHED" ? "breach" : "risk"}
      className={cn("whitespace-nowrap", className)}
    >
      {state === "BREACHED" ? "SLA vencido" : "SLA en riesgo"}
    </CommonSlaBadge>
  );
}
