"use server";

import { requirePermission } from "@/lib/auth/auth";
import {
  assignmentScopeWhere,
  fsrScopeWhere,
  getReportScope,
  incidentScopeWhere,
} from "@/lib/auth/report-scope";
import { CRITICAL_PRIORITY_THRESHOLD } from "@/lib/constants/incident-type";
import { prisma } from "@/lib/database/prisma.singleton";
import { INCIDENT_TERMINAL_STATES } from "@/lib/state-machine/incident-machine";

/** Both incident end states. An incident in either is no longer "active". */
const TERMINAL_INCIDENT_NAMES = [...INCIDENT_TERMINAL_STATES];

export async function getDashboardStats() {
  const scope = await getReportScope(await requirePermission("dashboard:view"));

  const [
    totalUsers,
    activeIncidents,
    openAssignments,
    scheduledTasks,
    recentIncidents,
    pendingAssignments,
    criticalIncidents,
  ] = await Promise.all([
    // Total users
    prisma.user.count({
      where: { active: true, ...fsrScopeWhere(scope) },
    }),

    // Active incidents: neither CERRADO nor CANCELADA.
    prisma.incident.count({
      where: {
        active: true,
        status: { name: { notIn: TERMINAL_INCIDENT_NAMES } },
        ...incidentScopeWhere(scope),
      },
    }),

    // Open assignments (not CERRADO)
    prisma.assignment.count({
      where: {
        active: true,
        status: {
          name: {
            in: [
              "PENDIENTE_DE_ASIGNACION",
              "ASIGNADO",
              "VISTO",
              "INICIADO",
              "EN_PROGRESO",
            ],
          },
        },
        ...assignmentScopeWhere(scope),
      },
    }),

    // Scheduled tasks (future schedules)
    prisma.schedule.count({
      where: {
        active: true,
        scheduledAt: { gte: new Date() },
      },
    }),

    // Recent incidents (last 5)
    prisma.incident.findMany({
      where: { active: true, ...incidentScopeWhere(scope) },
      include: {
        type: true,
        status: true,
        reportedBy: {
          select: { name: true },
        },
      },
      orderBy: { reportedAt: "desc" },
      take: 5,
    }),

    // Pending assignments (last 5)
    prisma.assignment.findMany({
      where: {
        active: true,
        status: {
          name: { in: ["PENDIENTE_DE_ASIGNACION", "ASIGNADO"] },
        },
        ...assignmentScopeWhere(scope),
      },
      include: {
        incident: {
          select: {
            title: true,
          },
        },
        assignees: {
          where: { active: true },
          include: {
            user: { select: { name: true } },
          },
        },
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Critical incidents: still active (non-terminal) and high-priority type.
    prisma.incident.count({
      where: {
        active: true,
        status: { name: { notIn: TERMINAL_INCIDENT_NAMES } },
        type: {
          priority: { gte: CRITICAL_PRIORITY_THRESHOLD },
        },
        ...incidentScopeWhere(scope),
      },
    }),
  ]);

  return {
    stats: {
      totalUsers,
      activeIncidents,
      openAssignments,
      scheduledTasks,
      criticalIncidents,
    },
    recentIncidents,
    pendingAssignments,
  };
}
