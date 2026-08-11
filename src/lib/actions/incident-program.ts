"use server";

import type { Prisma } from "@prisma/client";
import moment from "moment-timezone";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  buildIncidentProgram,
  classifyIncidentType,
  shortName,
} from "@/lib/reports/incident-program/builder";
import {
  type IncidentProgramReport,
  NO_SCHEDULE_ID,
  type ProgramEntry,
  type ScheduleOption,
  type VacationEntry,
} from "@/lib/reports/incident-program/types";
import { holidayRuleMatchesDate } from "@/lib/utils/availability";
import { APP_TZ, mxDateString } from "@/lib/utils/datetime";

export interface IncidentProgramFilters {
  /** Inclusive range, `YYYY-MM-DD` wall-clock dates in CDMX. */
  startDate: string;
  endDate: string;
  /**
   * Programaciones whose incidents are included. `NO_SCHEDULE_ID` additionally
   * pulls in incidents that belong to no programación. An empty/omitted list
   * means "everything in the range".
   */
  scheduleIds?: string[];
  /** Optional plaza filter — the source workbook is issued per plaza. */
  stateId?: number;
  /** Optional cliente (centro) filter. Narrower than `stateId`. */
  clienteId?: string;
}

/**
 * Widen a `YYYY-MM-DD` range into the UTC instants covering those CDMX days,
 * extended to the full ISO weeks the grid renders.
 */
function reportWindow(
  startDate: string,
  endDate: string,
): { from: Date; to: Date } {
  const start = moment.tz(startDate, "YYYY-MM-DD", APP_TZ);
  const end = moment.tz(endDate, "YYYY-MM-DD", APP_TZ);
  return {
    from: start.clone().startOf("isoWeek").startOf("day").toDate(),
    to: end.clone().endOf("isoWeek").endOf("day").toDate(),
  };
}

/**
 * The calendar day an incident occupies on the grid.
 *
 * Priority: the assignment's `scheduledDate` (the date the operation planned
 * the visit for, RF-708) and, when it was never planned, the date the incident
 * was reported. Both are read as CDMX calendar days.
 */
function effectiveDate(scheduledDate: Date | null, reportedAt: Date): string {
  return mxDateString(scheduledDate ?? reportedAt);
}

/** Active assignees of an assignment, as the short upper-case display names. */
function assigneeNames(assignees: { user: { name: string } }[]): string[] {
  return assignees.map((a) => shortName(a.user.name)).filter(Boolean);
}

/**
 * Incidents that fall inside the window, before the schedule selection is
 * applied. An incident counts when any of its active assignments is planned
 * inside the window, or — failing that — when it was reported inside it.
 */
function incidentWindowWhere(
  from: Date,
  to: Date,
  filters: Pick<IncidentProgramFilters, "stateId" | "clienteId">,
): Prisma.IncidentWhereInput {
  return {
    active: true,
    ...(filters.clienteId ? { clienteId: filters.clienteId } : {}),
    // A plaza filter constrains the cliente, so it composes with clienteId.
    ...(filters.stateId ? { cliente: { stateId: filters.stateId } } : {}),
    OR: [
      {
        assignments: {
          some: { active: true, scheduledDate: { gte: from, lte: to } },
        },
      },
      { reportedAt: { gte: from, lte: to } },
    ],
  };
}

/**
 * Programaciones that have incidents inside the range, for the report's
 * checkbox picker. Always ends with a "sin programación" pseudo-entry so
 * unlinked incidents can be included too.
 */
export async function getScheduleOptions(
  filters: Omit<IncidentProgramFilters, "scheduleIds">,
): Promise<ScheduleOption[]> {
  await requirePermission("reports:view");

  const { from, to } = reportWindow(filters.startDate, filters.endDate);
  const where = incidentWindowWhere(from, to, filters);

  const incidents = await prisma.incident.findMany({
    where,
    select: {
      scheduleId: true,
      cliente: { select: { code: true } },
      schedule: {
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          endDate: true,
        },
      },
    },
  });

  const grouped = new Map<string, ScheduleOption>();
  let unlinked = 0;

  for (const incident of incidents) {
    const code = incident.cliente?.code;

    if (!incident.schedule) {
      unlinked++;
      continue;
    }

    const existing = grouped.get(incident.schedule.id);
    if (existing) {
      existing.incidentCount++;
      if (code && !existing.clienteCodes.includes(code)) {
        existing.clienteCodes.push(code);
      }
      continue;
    }

    grouped.set(incident.schedule.id, {
      id: incident.schedule.id,
      title: incident.schedule.title,
      startDate: mxDateString(incident.schedule.scheduledAt),
      endDate: incident.schedule.endDate
        ? mxDateString(incident.schedule.endDate)
        : null,
      incidentCount: 1,
      clienteCodes: code ? [code] : [],
    });
  }

  const options = [...grouped.values()].sort((a, b) => {
    const byDate = (a.startDate ?? "").localeCompare(b.startDate ?? "");
    return byDate !== 0 ? byDate : a.title.localeCompare(b.title);
  });

  for (const option of options) option.clienteCodes.sort();

  if (unlinked > 0) {
    options.push({
      id: NO_SCHEDULE_ID,
      title: "Incidentes sin programación",
      startDate: null,
      endDate: null,
      incidentCount: unlinked,
      clienteCodes: [],
    });
  }

  return options;
}

const assignmentSelect = {
  scheduledDate: true,
  assignees: {
    where: { active: true },
    select: { user: { select: { name: true } } },
  },
} satisfies Prisma.AssignmentSelect;

/**
 * Build the incident report for a date range, restricted to the selected
 * programaciones.
 *
 * How incidents land on the grid:
 * - The row comes from the incident TYPE (see `classifyIncidentType`):
 *   mantenimiento / calibración fase II / opacímetro y gases occupy a CENTRO
 *   block at the incident's cliente; every other type (failures, supply…) is
 *   reactive work and feeds the RESPONSABLES INCIDENCIAS row.
 * - The column comes from `assignment.scheduledDate ?? incident.reportedAt`.
 * - Approved vacations feed the VACACIONES row; official holidays mark the
 *   CENTRO cell as FERIADO when no incident was recorded that day.
 */
export async function getIncidentProgramReport(
  filters: IncidentProgramFilters,
): Promise<IncidentProgramReport> {
  await requirePermission("reports:view");

  const { startDate, endDate, scheduleIds } = filters;
  const { from, to } = reportWindow(startDate, endDate);

  const where = incidentWindowWhere(from, to, filters);

  // An empty selection means "no filter"; otherwise restrict to the picked
  // programaciones, optionally including the unlinked ones.
  if (scheduleIds && scheduleIds.length > 0) {
    const realIds = scheduleIds.filter((id) => id !== NO_SCHEDULE_ID);
    const includeUnlinked = scheduleIds.includes(NO_SCHEDULE_ID);

    const scopes: Prisma.IncidentWhereInput[] = [];
    if (realIds.length > 0) scopes.push({ scheduleId: { in: realIds } });
    if (includeUnlinked) scopes.push({ scheduleId: null });

    // AND-composed with the window OR above, so both must hold.
    where.AND = [{ OR: scopes }];
  }

  const [incidents, vacations, holidayRules] = await Promise.all([
    prisma.incident.findMany({
      where,
      select: {
        reportedAt: true,
        type: { select: { name: true } },
        cliente: { select: { code: true } },
        assignments: { where: { active: true }, select: assignmentSelect },
      },
    }),
    prisma.vacation.findMany({
      where: {
        active: true,
        status: { name: "APROBADA" },
        startDate: { lte: to },
        endDate: { gte: from },
      },
      select: {
        startDate: true,
        endDate: true,
        user: { select: { name: true } },
      },
    }),
    prisma.holiday.findMany({ where: { active: true } }),
  ]);

  const entries: ProgramEntry[] = [];

  for (const incident of incidents) {
    const category = classifyIncidentType(incident.type?.name);
    const clienteCode = incident.cliente?.code ?? null;

    // One placement per active assignment, so an incident attended on two days
    // shows on both. Unassigned incidents still occupy their reported day.
    const occurrences = incident.assignments.length
      ? incident.assignments.map((a) => ({
          date: effectiveDate(a.scheduledDate, incident.reportedAt),
          responsables: assigneeNames(a.assignees),
        }))
      : [
          {
            date: effectiveDate(null, incident.reportedAt),
            responsables: [] as string[],
          },
        ];

    for (const occurrence of occurrences) {
      entries.push({
        date: occurrence.date,
        clienteCode,
        category,
        responsables: occurrence.responsables,
      });
    }
  }

  const vacationEntries: VacationEntry[] = [];
  for (const vacation of vacations) {
    const name = shortName(vacation.user.name);
    if (!name) continue;
    const cursor = moment.tz(
      mxDateString(vacation.startDate),
      "YYYY-MM-DD",
      APP_TZ,
    );
    const last = moment.tz(
      mxDateString(vacation.endDate),
      "YYYY-MM-DD",
      APP_TZ,
    );
    while (cursor.isSameOrBefore(last, "day")) {
      vacationEntries.push({
        date: cursor.format("YYYY-MM-DD"),
        responsables: [name],
      });
      cursor.add(1, "day");
    }
  }

  // Holiday rules are evaluated in memory (~8 active rows) against every day of
  // the window, matching `isHoliday` semantics without a query per day.
  const holidays: string[] = [];
  const dayCursor = moment(from).tz(APP_TZ).startOf("day");
  const lastDay = moment(to).tz(APP_TZ).startOf("day");
  while (dayCursor.isSameOrBefore(lastDay, "day")) {
    const dateStr = dayCursor.format("YYYY-MM-DD");
    if (holidayRules.some((rule) => holidayRuleMatchesDate(rule, dateStr))) {
      holidays.push(dateStr);
    }
    dayCursor.add(1, "day");
  }

  return buildIncidentProgram({
    startDate,
    endDate,
    entries,
    vacations: vacationEntries,
    holidays,
  });
}
