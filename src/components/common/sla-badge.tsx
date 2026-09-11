import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SlaTone = "ok" | "risk" | "breach" | "neutral";

const toneClass: Record<SlaTone, string> = {
  ok: "border-transparent bg-sla-ok-muted text-sla-ok",
  risk: "border-transparent bg-sla-risk-muted text-sla-risk",
  breach: "border-transparent bg-sla-breach-muted text-sla-breach",
  neutral: "border-transparent bg-muted text-muted-foreground",
};

interface SlaBadgeProps {
  tone?: SlaTone;
  children: React.ReactNode;
  className?: string;
}

/**
 * SLA badge driven by the `--sla-*` tokens.
 * Centralizes the SLA colors currently spread across the tracking screens.
 */
export function SlaBadge({
  tone = "neutral",
  children,
  className,
}: SlaBadgeProps) {
  return <Badge className={cn(toneClass[tone], className)}>{children}</Badge>;
}
