import { HomeWidget } from "@/components/home/widget-components";
import { WIDGET_SIZE_CLASS } from "@/components/home/widget-frame";
import { StaggerGroup, StaggerItem } from "@/components/motion/stagger";
import { requireAuth } from "@/lib/auth/auth";
import {
  selectWidgets,
  viewerFromUser,
  type WidgetId,
} from "@/lib/home/widgets";
import { cn } from "@/lib/utils";
import { formatMX, mxHour } from "@/lib/utils/datetime";

/**
 * Personal home (Fase 3): one route, widgets by permission.
 *
 * The layout already gated `/inicio`; here the union of the viewer's roles
 * decides which widgets render. Every widget streams behind its own
 * skeleton and fails alone — a broken loader never takes the page down.
 */

function greeting(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function InicioPage() {
  const user = await requireAuth();
  const viewer = viewerFromUser(user);
  const widgets = selectWidgets(viewer);

  // The quick-actions row lives above the grid; everything else tiles it.
  const quickActions = widgets.find((w) => w.id === "quick-actions");
  const rest = widgets.filter((w) => w.id !== "quick-actions");

  const now = new Date();
  const summary = summaryLine(rest.map((w) => w.id));

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Bienvenida"
        className="bg-opus-hero rounded-xl border p-5"
      >
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting(mxHour(now))}, {user.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatMX(now, { dateStyle: "full" })}
          {summary ? ` · ${summary}` : ""}
        </p>
      </section>

      {quickActions && <HomeWidget id={quickActions.id} viewer={viewer} />}

      {rest.length > 0 && (
        <StaggerGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {rest.map((widget) => (
            <StaggerItem
              key={widget.id}
              className={cn(WIDGET_SIZE_CLASS[widget.size])}
            >
              <HomeWidget id={widget.id} viewer={viewer} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  );
}

/** One honest line about what waits, from the visible widget set. */
function summaryLine(ids: WidgetId[]): string | null {
  if (ids.includes("tracking-queue")) return "así va la operación hoy";
  if (ids.includes("my-work")) return "así va tu trabajo hoy";
  if (ids.includes("my-reports")) return "así van tus reportes";
  if (ids.includes("vacation-approvals")) return "tienes decisiones pendientes";
  if (ids.includes("my-vacation")) return "este es tu resumen";
  return null;
}
