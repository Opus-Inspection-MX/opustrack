"use server";

import { requirePermission } from "@/lib/auth/auth";
import { CRITICAL_PRIORITY_THRESHOLD } from "@/lib/constants/incident-type";
import { prisma } from "@/lib/database/prisma.singleton";

export async function getDashboardStats() {
  // Admin can see all stats
  await requirePermission("dashboard:view");

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
      where: { active: true },
    }),

    // Active incidents (not closed)
    prisma.incident.count({
      where: {
        active: true,
        status: {
          name: { not: "CERRADO" },
        },
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
      where: { active: true },
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

    // Critical incidents: active, not CERRADO, type priority >= threshold
    prisma.incident.count({
      where: {
        active: true,
        status: {
          name: { not: "CERRADO" },
        },
        type: {
          priority: { gte: CRITICAL_PRIORITY_THRESHOLD },
        },
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
