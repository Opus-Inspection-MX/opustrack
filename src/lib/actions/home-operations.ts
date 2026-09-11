"use server";

import { getDashboardStats } from "@/lib/actions/dashboard";
import { requirePermission } from "@/lib/auth/auth";
import {
  getReportScope,
  incidentScopeWhere,
  scheduleScopeWhere,
} from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";
import { INCIDENT_TERMINAL_STATES } from "@/lib/state-machine/incident-machine";

/**
 * Operations home loaders (Fase 3): one widget, one loader, one permission.
 *
 * Same contract as `home-personal`: the registry filters, the loader
 * authorizes. Scopes ride through `*ScopeWhere` and fail closed —
 * `clientIds: []` matches nothing, never everything.
 */

const TERMINAL_INCIDENT_NAMES = [...INCIDENT_TERMINAL_STATES];

/**
 * Open tracking queue (widget tracking-queue): open incidents in scope,
 * oldest first, capped at 5. The widget derives the SLA age from reportedAt
 * plus the type priority — no extra computation lives here.
 */
export async function getTrackingQueue() {
  const user = await requirePermission("tracking:read");
  const scope = await getReportScope(user);

  const queue = await prisma.incident.findMany({
    where: {
      active: true,
      status: { name: { notIn: TERMINAL_INCIDENT_NAMES } },
      ...incidentScopeWhere(scope),
    },
    include: {
      type: { select: { id: true, name: true, priority: true } },
      status: true,
      client: { select: { id: true, name: true, code: true } },
    },
    orderBy: { reportedAt: "asc" },
    take: 5,
  });

  return { queue };
}

/**
 * Operations KPIs (widget ops-kpis): the scoped dashboard stats. Each KPI
 * links only when the viewer can open the target — the component gates
 * with canAccessRoute, this loader only counts.
 */
export async function getOperationalKpis() {
  await requirePermission("dashboard:view");

  const { stats } = await getDashboardStats();

  return { stats };
}

/**
 * Incidents by status (widget incidents-by-status): open-incident counts
 * grouped by status inside the caller's scope, with catalog color for the
 * chart and badges.
 */
export async function getIncidentsByStatus() {
  const user = await requirePermission("incidents:read");
  const scope = await getReportScope(user);

  const groups = await prisma.incident.groupBy({
    by: ["statusId"],
    where: {
      active: true,
      status: { name: { notIn: TERMINAL_INCIDENT_NAMES } },
      ...incidentScopeWhere(scope),
    },
    _count: { statusId: true },
  });

  const statuses = await prisma.incidentStatus.findMany({
    where: {
      id: { in: groups.map((g) => g.statusId).filter((id) => id !== null) },
    },
    select: { id: true, name: true, color: true },
  });
  const byId = new Map(statuses.map((s) => [s.id, s]));

  return {
    groups: groups.map((g) => ({
      statusId: g.statusId,
      name: g.statusId !== null ? (byId.get(g.statusId)?.name ?? null) : null,
      // Catalog color travels as data (never a source literal): the style
      // contract forbids raw hex outside the token layer, and the seed
      // guarantees every status row carries its own color.
      color:
        g.statusId !== null ? (byId.get(g.statusId)?.color ?? null) : null,
      count: g._count.statusId,
    })),
  };
}

/**
 * Upcoming schedules (widget upcoming-schedules): the next 5 future
 * schedules in scope. The widget links to /admin/schedules only when the
 * viewer can open it.
 */
export async function getUpcomingSchedules() {
  const user = await requirePermission("schedules:read");
  const scope = await getReportScope(user);

  const schedules = await prisma.schedule.findMany({
    where: {
      active: true,
      scheduledAt: { gte: new Date() },
      ...scheduleScopeWhere(scope),
    },
    include: {
      status: { select: { id: true, name: true, color: true } },
      clients: {
        where: { active: true },
        include: {
          client: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });

  return { schedules };
}
