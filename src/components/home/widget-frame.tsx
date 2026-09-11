import type React from "react";
import { Suspense } from "react";
import { WidgetSkeleton } from "@/components/common/skeletons";
import type { WidgetSize } from "@/lib/home/widgets";
import { cn } from "@/lib/utils";

/**
 * The frame every /inicio widget renders inside (Fase 3).
 *
 * A `data-widget-id` hook for the e2e contract, one `<h2>` title, the grid
 * footprint for its size, and a Suspense boundary so each widget streams in
 * behind a skeleton instead of blocking its neighbors.
 */

export const WIDGET_SIZE_CLASS: Record<WidgetSize, string> = {
  sm: "",
  md: "md:col-span-2",
  lg: "md:col-span-2 xl:col-span-4",
};

export function WidgetFrame({
  widgetId,
  title,
  size,
  action,
  children,
}: {
  widgetId: string;
  title: string;
  size: WidgetSize;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      data-widget-id={widgetId}
      aria-label={title}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card",
        WIDGET_SIZE_CLASS[size],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      <Suspense fallback={<WidgetSkeleton />}>{children}</Suspense>
    </section>
  );
}
