import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return (
    <output aria-label="Cargando contenido">
      <Skeleton className={cn(className)} />
    </output>
  );
}

/**
 * Full-page loading skeleton: header line plus content blocks.
 */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl space-y-6", className)}>
      <div className="space-y-2">
        <Block className="h-8 w-1/3" />
        <Block className="h-4 w-1/2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton count
          <Block key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Block className="h-64 w-full rounded-xl" />
    </div>
  );
}

/**
 * Table-shaped loading skeleton for list screens.
 */
export function TableSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton count
        <Block key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/**
 * Card-grid loading skeleton for catalog overviews.
 */
export function CardGridSkeleton({
  cards = 6,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: cards }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton count
        <Block key={i} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Small widget loading skeleton for /inicio (Fase 3) and dashboards.
 */
export function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-xl border p-4", className)}>
      <Block className="h-5 w-2/3" />
      <Block className="h-9 w-1/2" />
      <Block className="h-4 w-full" />
    </div>
  );
}
