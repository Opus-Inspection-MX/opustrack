"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardTone =
  | "default"
  | "success"
  | "warning"
  | "info"
  | "danger";

const toneIconClass: Record<StatCardTone, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success-muted text-success-muted-foreground",
  warning: "bg-warning-muted text-warning-muted-foreground",
  info: "bg-info-muted text-info-muted-foreground",
  danger: "bg-danger-muted text-danger-muted-foreground",
};

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  /** Optional link wrapping the whole card. */
  href?: string;
  tone?: StatCardTone;
  className?: string;
}

/**
 * Generalized KPI card. Numeric values animate with a spring counter;
 * string values render as-is. Replaces the six hand-made KPI variants.
 */
export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  href,
  tone = "default",
  className,
}: StatCardProps) {
  const body = (
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">
              {typeof value === "number" ? (
                <AnimatedNumber value={value} />
              ) : (
                value
              )}
            </p>
            {trend && (
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.isPositive
                    ? "text-success-muted-foreground"
                    : "text-danger-muted-foreground",
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg",
              toneIconClass[tone],
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Card interactive className={className}>
        <Link
          href={href}
          aria-label={title}
          className="rounded-xl focus-visible:outline-2"
        >
          {body}
        </Link>
      </Card>
    );
  }

  return <Card className={className}>{body}</Card>;
}
