"use server";

import { requirePermission } from "@/lib/auth/auth";
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

    // Open assignments
    prisma.assignment.count({
      where: {
        active: true,
        status: {
          name: { in: ["PENDIENTE", "ASIGNADO", "EN_PROGRESO"] },
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
          name: { in: ["PENDIENTE", "ASIGNADO"] },
        },
      },
      include: {
        incident: {
          select: {
            title: true,
          },
        },
        assignedTo: {
          select: { name: true },
        },
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Count critical incidents
  const criticalIncidents = await prisma.incident.count({
    where: {
      active: true,
      priority: { gte: 8 },
      status: {
        name: { not: "CERRADO" },
      },
    },
  });

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
