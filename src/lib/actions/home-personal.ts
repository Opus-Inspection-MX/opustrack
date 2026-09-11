"use server";

import { requirePermission } from "@/lib/auth/auth";
import { getReportScope, incidentScopeWhere } from "@/lib/auth/report-scope";
import { VACATION_STATUS } from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";
import { ASSIGNMENT_STATE } from "@/lib/state-machine/assignment-machine";
import { getPrimaryClientId } from "@/lib/utils/client-assignments";
import { mxDayRange, mxTodayString } from "@/lib/utils/datetime";

/**
 * Personal home loaders (Fase 3): one widget, one loader, one permission.
 *
 * Every loader repeats the permission its registry entry declares — the
 * registry filters, it never authorizes. Ownership always comes from the
 * session (`requirePermission` → `user.id`); a userId is never accepted
 * from the client. Non-admin scopes ride through `*ScopeWhere`, fail
 * closed (`clientIds: []` matches nothing, never everything).
 */

const NOT_STARTED = [
  ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
  ASSIGNMENT_STATE.ASIGNADO,
] as const;

const IN_PROGRESS = [
  ASSIGNMENT_STATE.VISTO,
  ASSIGNMENT_STATE.INICIADO,
  ASSIGNMENT_STATE.EN_PROGRESO,
] as const;

/**
 * Own work summary (widget my-work).
 * Same ownership filter as getMyAssignments, narrowed to counts plus the
 * five oldest open assignments — the ones that need attention first.
 */
export async function getMyWorkSummary() {
  const user = await requirePermission("assignments:read");
  const scope = await getReportScope(user);

  const mine = {
    assignees: { some: { userId: user.id, active: true } },
    active: true,
    incident: { ...incidentScopeWhere(scope) },
  };

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [notStarted, inProgress, closedWeek, upcoming] = await Promise.all([
    prisma.assignment.count({
      where: { ...mine, status: { code: { in: [...NOT_STARTED] } } },
    }),
    prisma.assignment.count({
      where: { ...mine, status: { code: { in: [...IN_PROGRESS] } } },
    }),
    prisma.assignment.count({
      where: {
        ...mine,
        status: { code: ASSIGNMENT_STATE.CERRADO },
        finishedAt: { gte: weekAgo },
      },
    }),
    prisma.assignment.findMany({
      where: {
        ...mine,
        status: { code: { not: ASSIGNMENT_STATE.CERRADO } },
      },
      include: {
        status: true,
        incident: {
          select: {
            id: true,
            title: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
  ]);

  return { notStarted, inProgress, closedWeek, upcoming };
}

/**
 * Own trip status (widget my-active-trip): the open trip, if any, plus
 * today's trips. The widget offers "Finalizar viaje" over the open one and
 * "Iniciar viaje" otherwise.
 */
export async function getMyActiveTrip() {
  const user = await requirePermission("vehicle-trips:read");

  const { gte: todayStart } = mxDayRange(mxTodayString());

  const [open, today] = await Promise.all([
    prisma.vehicleTrip.findFirst({
      where: { fsrId: user.id, active: true, endedAt: null },
      include: { vehicle: true, status: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.vehicleTrip.findMany({
      where: { fsrId: user.id, active: true, startedAt: { gte: todayStart } },
      include: { vehicle: { select: { id: true, licensePlate: true } } },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return { open, today, todayCount: today.length };
}

/**
 * Own reports summary (widget my-reports): counts by status plus the last
 * five, limited to the primary Client. A reporter without a primary Client
 * sees an empty widget — never other centers' incidents.
 */
export async function getMyReportsSummary() {
  const user = await requirePermission("incidents:create");

  const clientId = await getPrimaryClientId(user.id);
  if (!clientId) {
    return { byStatus: [], recent: [] };
  }

  const mine = { reportedById: user.id, clientId, active: true };

  const [byStatus, recent] = await Promise.all([
    prisma.incident.groupBy({
      by: ["statusId"],
      where: mine,
      _count: { statusId: true },
    }),
    prisma.incident.findMany({
      where: mine,
      include: {
        type: { select: { name: true } },
        status: true,
      },
      orderBy: { reportedAt: "desc" },
      take: 5,
    }),
  ]);

  return { byStatus, recent };
}

/**
 * Own vacation summary (widget my-vacation): balance of non-expired periods
 * plus upcoming approved requests. Callers without a hire date (or with no
 * periods yet) get zeros, not an error — the widget shows an empty state.
 */
export async function getMyVacationSummary() {
  const user = await requirePermission("vacations:read");

  const [periods, upcoming, pending] = await Promise.all([
    prisma.vacationPeriod.findMany({
      where: {
        userId: user.id,
        graceEnd: { gte: new Date() },
      },
      select: {
        id: true,
        periodNumber: true,
        ruleDays: true,
        overrideDays: true,
        vacations: {
          where: {
            active: true,
            status: { code: VACATION_STATUS.APROBADA },
          },
          select: { businessDaysUsed: true },
        },
      },
      orderBy: { periodNumber: "desc" },
    }),
    prisma.vacation.findMany({
      where: {
        userId: user.id,
        active: true,
        startDate: { gte: new Date() },
        status: { code: VACATION_STATUS.APROBADA },
      },
      include: { status: { select: { name: true, color: true } } },
      orderBy: { startDate: "asc" },
      take: 3,
    }),
    prisma.vacation.count({
      where: {
        userId: user.id,
        active: true,
        status: { code: VACATION_STATUS.PENDIENTE },
      },
    }),
  ]);

  const availableDays = periods.reduce((sum, p) => {
    const granted = p.overrideDays ?? p.ruleDays;
    const used = p.vacations.reduce(
      (sub, v) => sub + (v.businessDaysUsed ?? 0),
      0,
    );
    return sum + Math.max(0, granted - used);
  }, 0);

  return { availableDays, upcoming, pending };
}

/**
 * Pending approvals queue (widget vacation-approvals): PENDIENTE count plus
 * the top five oldest — the ones waiting longest decide first.
 */
export async function getPendingVacationApprovals() {
  await requirePermission("vacations:approve");

  const where = {
    active: true,
    status: { code: VACATION_STATUS.PENDIENTE },
  };

  const [count, top] = await Promise.all([
    prisma.vacation.count({ where }),
    prisma.vacation.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        status: { select: { name: true, color: true } },
      },
      orderBy: { startDate: "asc" },
      take: 5,
    }),
  ]);

  return { count, top };
}

/**
 * Upcoming absences (widget upcoming-absences): approved vacations starting
 * within the next 14 days, capped at 8.
 */
export async function getUpcomingAbsences() {
  await requirePermission("vacations:manage");

  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const absences = await prisma.vacation.findMany({
    where: {
      active: true,
      status: { code: VACATION_STATUS.APROBADA },
      startDate: { gte: now, lte: horizon },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      status: { select: { name: true, color: true } },
    },
    orderBy: { startDate: "asc" },
    take: 8,
  });

  return { absences };
}
