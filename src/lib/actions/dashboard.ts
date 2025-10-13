"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";

export async function getDashboardStats() {
  // Admin can see all stats
  await requirePermission("users:read");

  const [
    totalUsers,
    activeIncidents,
    openWorkOrders,
    scheduledTasks,
    recentIncidents,
    pendingWorkOrders,
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

    // Open work orders
    prisma.workOrder.count({
      where: {
        active: true,
        status: { in: ["ABIERTO", "EN_PROGRESO", "PENDIENTE"] },
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

    // Pending work orders (last 5)
    prisma.workOrder.findMany({
      where: {
        active: true,
        status: { in: ["ABIERTO", "PENDIENTE"] },
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
      openWorkOrders,
      scheduledTasks,
      criticalIncidents,
    },
    recentIncidents,
    pendingWorkOrders,
  };
}
