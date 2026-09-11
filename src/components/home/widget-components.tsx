import Link from "next/link";
import type React from "react";
import { Suspense } from "react";
import { WidgetSkeleton } from "@/components/common/skeletons";
import { StatusBadge } from "@/components/common/status-badge";
import { AnimatedNumber } from "@/components/motion/animated-number";
import {
  getIncidentsByStatus,
  getOperationalKpis,
  getTrackingQueue,
  getUpcomingSchedules,
} from "@/lib/actions/home-operations";
import {
  getMyActiveTrip,
  getMyReportsSummary,
  getMyVacationSummary,
  getMyWorkSummary,
  getPendingVacationApprovals,
  getUpcomingAbsences,
} from "@/lib/actions/home-personal";
import {
  getMyNotifications,
  getMyUnreadCount,
} from "@/lib/actions/notifications";
import { getSlaBreachData } from "@/lib/actions/reports";
import { AuthorizationError } from "@/lib/auth/auth";
import { canAccessRoute } from "@/lib/authz/route-access";
import {
  type QuickActionDef,
  visibleQuickActions,
} from "@/lib/home/quick-actions";
import {
  WIDGETS,
  type WidgetDefinition,
  type WidgetId,
  type WidgetViewer,
} from "@/lib/home/widgets";
import { logger } from "@/lib/observability/logger";
import { formatMX } from "@/lib/utils/datetime";
import { WidgetFrame } from "./widget-frame";

/**
 * One component per widget id — `satisfies Record<WidgetId, …>` so tsc
 * forces every registry id to have a component and vice versa.
 *
 * Each component loads its own data through `safeLoad`: a failing widget
 * renders "No se pudo cargar" instead of taking the page down, an
 * authorization fault only warns (a stale registry entry must not page
 * anyone), and a framework redirect still propagates.
 */

export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; denied: boolean };

export async function safeLoad<T>(
  widgetId: string,
  load: () => Promise<T>,
): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    // NEXT_REDIRECT is control flow (requireRouteAccess inside a loader),
    // not a fault — it must keep travelling.
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    if (error instanceof AuthorizationError) {
      logger.warn("home.widget_denied", { widgetId });
      return { ok: false, denied: true };
    }
    logger.error("home.widget_failed", { widgetId, error });
    return { ok: false, denied: false };
  }
}

function widgetMeta(id: WidgetId): WidgetDefinition {
  const def = WIDGETS.find((w) => w.id === id);
  if (!def) throw new Error(`Unknown home widget ${id}`);
  return def;
}

function LoadError({ widgetId }: { widgetId: WidgetId }) {
  const meta = widgetMeta(widgetId);
  return (
    <WidgetFrame widgetId={widgetId} title={meta.title} size={meta.size}>
      <p className="text-sm text-muted-foreground">No se pudo cargar.</p>
    </WidgetFrame>
  );
}

function WidgetLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-primary hover:underline"
    >
      {children}
    </Link>
  );
}

function Kpi({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const number = (
    <AnimatedNumber value={value} className="text-2xl font-bold tabular-nums" />
  );
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {href ? <Link href={href}>{number}</Link> : number}
    </div>
  );
}

export interface WidgetProps {
  viewer: WidgetViewer;
}

async function QuickActionsWidget({ viewer }: WidgetProps) {
  const meta = widgetMeta("quick-actions");
  const actions: QuickActionDef[] = visibleQuickActions(viewer);
  if (actions.length === 0) return null;
  return (
    <WidgetFrame widgetId="quick-actions" title={meta.title} size={meta.size}>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {actions.map((action) => (
          <li key={action.url}>
            <Link
              href={action.url}
              className="flex h-full flex-col gap-1 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/50"
            >
              <action.icon className="h-5 w-5 text-primary" aria-hidden />
              <span className="text-sm font-medium">{action.title}</span>
              <span className="text-xs text-muted-foreground">
                {action.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetFrame>
  );
}

async function NotificationsWidget(_props: WidgetProps) {
  const result = await safeLoad("notifications", async () => {
    const [unread, recent] = await Promise.all([
      getMyUnreadCount(),
      getMyNotifications({ limit: 5 }),
    ]);
    return { unread, recent };
  });
  if (!result.ok) return <LoadError widgetId="notifications" />;
  const meta = widgetMeta("notifications");
  const { unread, recent } = result.data;
  return (
    <WidgetFrame
      widgetId="notifications"
      title={meta.title}
      size={meta.size}
      action={<WidgetLink href="/notifications">Ver todas</WidgetLink>}
    >
      <p className="text-sm text-muted-foreground">
        <AnimatedNumber value={unread} className="font-bold text-foreground" />{" "}
        sin leer
      </p>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin avisos recientes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recent.map((n) => (
            <li
              key={n.id}
              className="flex flex-col gap-0.5 border-b pb-2 last:border-0"
            >
              <span className="text-sm font-medium">{n.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatMX(n.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

async function MyWorkWidget({ viewer }: WidgetProps) {
  const result = await safeLoad("my-work", getMyWorkSummary);
  if (!result.ok) return <LoadError widgetId="my-work" />;
  const meta = widgetMeta("my-work");
  const { notStarted, inProgress, closedWeek, upcoming } = result.data;
  if (
    viewer.isSuperuser &&
    notStarted === 0 &&
    inProgress === 0 &&
    upcoming.length === 0
  ) {
    return null;
  }
  return (
    <WidgetFrame
      widgetId="my-work"
      title={meta.title}
      size={meta.size}
      action={<WidgetLink href="/fsr/assignments">Ver todas</WidgetLink>}
    >
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Sin iniciar" value={notStarted} />
        <Kpi label="En progreso" value={inProgress} />
        <Kpi label="Cerradas (7d)" value={closedWeek} />
      </div>
      {upcoming.length > 0 && (
        <ul className="flex flex-col gap-2">
          {upcoming.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
            >
              <span className="truncate font-medium">
                {a.incident?.title ?? `Asignación ${a.folio ?? ""}`}
              </span>
              <StatusBadge tone="progress">{a.status?.name ?? ""}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

async function MyActiveTripWidget({ viewer }: WidgetProps) {
  const result = await safeLoad("my-active-trip", getMyActiveTrip);
  if (!result.ok) return <LoadError widgetId="my-active-trip" />;
  const meta = widgetMeta("my-active-trip");
  const { open, todayCount } = result.data;
  if (viewer.isSuperuser && !open && todayCount === 0) return null;
  return (
    <WidgetFrame widgetId="my-active-trip" title={meta.title} size={meta.size}>
      {open ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Viaje en curso ·{" "}
            <span className="font-medium">
              {open.vehicle?.licensePlate ?? "Vehículo"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Inicio: {formatMX(open.startedAt)}
          </p>
          <WidgetLink href={`/fsr/vehicle-trips/${open.id}`}>
            Finalizar viaje
          </WidgetLink>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {todayCount > 0
              ? `${todayCount} viaje(s) hoy.`
              : "Sin viaje en curso."}
          </p>
          <WidgetLink href="/fsr/vehicle-trips/start">Iniciar viaje</WidgetLink>
        </div>
      )}
    </WidgetFrame>
  );
}

async function MyReportsWidget({ viewer }: WidgetProps) {
  const result = await safeLoad("my-reports", getMyReportsSummary);
  if (!result.ok) return <LoadError widgetId="my-reports" />;
  const meta = widgetMeta("my-reports");
  const { byStatus, recent } = result.data;
  if (viewer.isSuperuser && recent.length === 0) return null;
  const total = byStatus.reduce((sum, g) => sum + g._count.statusId, 0);
  return (
    <WidgetFrame
      widgetId="my-reports"
      title={meta.title}
      size={meta.size}
      action={<WidgetLink href="/reporter">Ver todos</WidgetLink>}
    >
      <p className="text-sm text-muted-foreground">
        <AnimatedNumber value={total} className="font-bold text-foreground" />{" "}
        reportes en tu centro
      </p>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no levantas reportes.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recent.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
            >
              <Link
                href={`/reporter/incidents/${i.id}`}
                className="truncate font-medium hover:underline"
              >
                {i.title}
              </Link>
              <StatusBadge tone="open">{i.status?.name ?? ""}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

async function MyVacationWidget({ viewer }: WidgetProps) {
  const result = await safeLoad("my-vacation", getMyVacationSummary);
  if (!result.ok) return <LoadError widgetId="my-vacation" />;
  const meta = widgetMeta("my-vacation");
  const { availableDays, upcoming, pending } = result.data;
  if (
    viewer.isSuperuser &&
    availableDays === 0 &&
    upcoming.length === 0 &&
    pending === 0
  ) {
    return null;
  }
  return (
    <WidgetFrame
      widgetId="my-vacation"
      title={meta.title}
      size={meta.size}
      action={<WidgetLink href="/vacations">Ver todas</WidgetLink>}
    >
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Días disponibles" value={availableDays} />
        <Kpi label="Pendientes" value={pending} />
      </div>
      {upcoming.length > 0 && (
        <ul className="flex flex-col gap-2">
          {upcoming.map((v) => (
            <li key={v.id} className="text-sm">
              <span className="font-medium">
                {formatMX(v.startDate, { dateStyle: "medium" })}
              </span>
              <span className="text-muted-foreground">
                {" → "}
                {formatMX(v.endDate, { dateStyle: "medium" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

async function VacationApprovalsWidget(_props: WidgetProps) {
  const result = await safeLoad(
    "vacation-approvals",
    getPendingVacationApprovals,
  );
  if (!result.ok) return <LoadError widgetId="vacation-approvals" />;
  const meta = widgetMeta("vacation-approvals");
  const { count, top } = result.data;
  return (
    <WidgetFrame
      widgetId="vacation-approvals"
      title={meta.title}
      size={meta.size}
      action={<WidgetLink href="/admin/vacations">Decidir</WidgetLink>}
    >
      <p className="text-sm text-muted-foreground">
        <AnimatedNumber value={count} className="font-bold text-foreground" />{" "}
        pendientes
      </p>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada por decidir.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {top.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
            >
              <span className="truncate font-medium">
                {v.user?.name ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatMX(v.startDate, { dateStyle: "medium" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

async function UpcomingAbsencesWidget(_props: WidgetProps) {
  const result = await safeLoad("upcoming-absences", getUpcomingAbsences);
  if (!result.ok) return <LoadError widgetId="upcoming-absences" />;
  const meta = widgetMeta("upcoming-absences");
  const { absences } = result.data;
  return (
    <WidgetFrame
      widgetId="upcoming-absences"
      title={meta.title}
      size={meta.size}
      action={<WidgetLink href="/admin/vacations">Ver todas</WidgetLink>}
    >
      {absences.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nadie fuera en los próximos 14 días.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {absences.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
            >
              <span className="truncate font-medium">
                {v.user?.name ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatMX(v.startDate, { dateStyle: "medium" })}
                {" → "}
                {formatMX(v.endDate, { dateStyle: "medium" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

function incidentAge(reportedAt: Date): string {
  const days = Math.max(
    0,
    Math.floor((Date.now() - reportedAt.getTime()) / 86_400_000),
  );
  return days === 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`;
}

async function TrackingQueueWidget(_props: WidgetProps) {
  const result = await safeLoad("tracking-queue", getTrackingQueue);
  if (!result.ok) return <LoadError widgetId="tracking-queue" />;
  const meta = widgetMeta("tracking-queue");
  const { queue } = result.data;
  return (
    <WidgetFrame
      widgetId="tracking-queue"
      title={meta.title}
      size={meta.size}
      action={<WidgetLink href="/admin/tracking">Abrir seguimiento</WidgetLink>}
    >
      {queue.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cola vacía.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {queue.map((i) => (
            <li
              key={i.id}
              className="flex flex-col gap-1 rounded-lg border p-3"
            >
              <Link
                href={`/admin/incidents/${i.id}`}
                className="truncate text-sm font-medium hover:underline"
              >
                {i.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {i.client?.name ?? "Sin centro"} · {incidentAge(i.reportedAt)}
              </span>
              <StatusBadge tone="open" className="w-fit">
                {i.status?.name ?? ""}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

async function OpsKpisWidget({ viewer }: WidgetProps) {
  const result = await safeLoad("ops-kpis", getOperationalKpis);
  if (!result.ok) return <LoadError widgetId="ops-kpis" />;
  const meta = widgetMeta("ops-kpis");
  const { stats } = result.data;
  const link = (route: string, fallback?: string) =>
    canAccessRoute(viewer.routeGrants, viewer.isSuperuser, route)
      ? route
      : fallback;
  return (
    <WidgetFrame widgetId="ops-kpis" title={meta.title} size={meta.size}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label="Incidentes activos"
          value={stats.activeIncidents}
          href={link("/admin/incidents")}
        />
        <Kpi
          label="Asignaciones abiertas"
          value={stats.openAssignments}
          href={link("/admin/assignments")}
        />
        <Kpi
          label="Programadas"
          value={stats.scheduledTasks}
          href={link("/admin/schedules")}
        />
        <Kpi
          label="Críticos"
          value={stats.criticalIncidents}
          href={link("/admin/incidents")}
        />
        <Kpi
          label="Usuarios activos"
          value={stats.totalUsers}
          href={link("/admin/users")}
        />
      </div>
    </WidgetFrame>
  );
}

async function IncidentsByStatusWidget(_props: WidgetProps) {
  const result = await safeLoad("incidents-by-status", getIncidentsByStatus);
  if (!result.ok) return <LoadError widgetId="incidents-by-status" />;
  const meta = widgetMeta("incidents-by-status");
  const { groups } = result.data;
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  return (
    <WidgetFrame
      widgetId="incidents-by-status"
      title={meta.title}
      size={meta.size}
      action={<WidgetLink href="/admin/incidents">Ver todos</WidgetLink>}
    >
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin incidentes abiertos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li
              key={g.statusId ?? "none"}
              className="flex items-center gap-2 text-sm"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: g.color }}
                aria-hidden
              />
              <span className="flex-1 truncate font-medium">
                {g.name ?? "Sin estado"}
              </span>
              <AnimatedNumber value={g.count} className="tabular-nums" />
              <span className="w-10 text-right text-xs text-muted-foreground">
                {total > 0 ? `${Math.round((g.count / total) * 100)}%` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

async function SlaRiskWidget(_props: WidgetProps) {
  const result = await safeLoad("sla-risk", () => getSlaBreachData());
  if (!result.ok) return <LoadError widgetId="sla-risk" />;
  const meta = widgetMeta("sla-risk");
  const rows = result.data;
  const breached = rows.reduce((sum, r) => sum + r.breached, 0);
  const atRisk = rows.reduce((sum, r) => sum + r.atRisk, 0);
  const top = rows.filter((r) => r.breached + r.atRisk > 0).slice(0, 3);
  return (
    <WidgetFrame
      widgetId="sla-risk"
      title={meta.title}
      size={meta.size}
      action={
        <WidgetLink href="/admin/reports/sla-breach">Ver reporte</WidgetLink>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Vencidos" value={breached} />
        <Kpi label="En riesgo" value={atRisk} />
      </div>
      {top.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {top.map((r) => (
            <li
              key={r.type}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate text-muted-foreground">{r.type}</span>
              <span className="tabular-nums">
                {r.breached + r.atRisk}/{r.total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

async function UpcomingSchedulesWidget({ viewer }: WidgetProps) {
  const result = await safeLoad("upcoming-schedules", getUpcomingSchedules);
  if (!result.ok) return <LoadError widgetId="upcoming-schedules" />;
  const meta = widgetMeta("upcoming-schedules");
  const { schedules } = result.data;
  const listHref = canAccessRoute(
    viewer.routeGrants,
    viewer.isSuperuser,
    "/admin/schedules",
  )
    ? "/admin/schedules"
    : undefined;
  return (
    <WidgetFrame
      widgetId="upcoming-schedules"
      title={meta.title}
      size={meta.size}
      action={
        listHref ? (
          <WidgetLink href={listHref}>Ver todas</WidgetLink>
        ) : undefined
      }
    >
      {schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada agendado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {schedules.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-0.5 border-b pb-2 text-sm last:border-0"
            >
              <span className="truncate font-medium">{s.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatMX(s.scheduledAt)}
                {s.clients.length > 0 &&
                  ` · ${s.clients.map((c) => c.client.code).join(", ")}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

export const WIDGET_COMPONENTS = {
  "quick-actions": QuickActionsWidget,
  notifications: NotificationsWidget,
  "my-work": MyWorkWidget,
  "my-active-trip": MyActiveTripWidget,
  "my-reports": MyReportsWidget,
  "my-vacation": MyVacationWidget,
  "vacation-approvals": VacationApprovalsWidget,
  "upcoming-absences": UpcomingAbsencesWidget,
  "tracking-queue": TrackingQueueWidget,
  "ops-kpis": OpsKpisWidget,
  "incidents-by-status": IncidentsByStatusWidget,
  "sla-risk": SlaRiskWidget,
  "upcoming-schedules": UpcomingSchedulesWidget,
} satisfies Record<WidgetId, (props: WidgetProps) => Promise<React.ReactNode>>;

/** One streaming slot: the widget resolves behind a skeleton. */
export function HomeWidget({
  id,
  viewer,
}: {
  id: WidgetId;
  viewer: WidgetViewer;
}) {
  const Component = WIDGET_COMPONENTS[id];
  return (
    <Suspense fallback={<WidgetSkeleton />}>
      <Component viewer={viewer} />
    </Suspense>
  );
}
