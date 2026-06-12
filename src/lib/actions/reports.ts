"use server";

import moment from "moment-timezone";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  APP_TZ,
  mxDateString,
  mxDayRange,
  mxDaysAgoString,
  mxTodayString,
} from "@/lib/utils/datetime";

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type FSRPerformanceData = {
  fsrId: string;
  fsrName: string;
  totalAssignments: number;
  completedAssignments: number;
  averageCompletionTime: number; // in hours
  totalActivities: number;
  totalTrips: number;
  totalKmDriven: number;
};

export type AssignmentStatusData = {
  status: string;
  count: number;
  percentage: number;
};

export type IncidentTrendData = {
  date: string;
  count: number;
  resolved: number;
};

export type IncidentByTypeData = {
  type: string;
  priority: number;
  count: number;
  percentage: number;
};

export type VehicleTripData = {
  date: string;
  trips: number;
  totalKm: number;
};

export type FSRTripData = {
  fsrId: string;
  fsrName: string;
  trips: number;
  totalKm: number;
  averageKm: number;
};

export type PartUsageData = {
  partId: string;
  partName: string;
  totalUsed: number;
  totalCost: number;
  currentStock: number;
};

/**
 * Get FSR Performance Report Data
 */
export async function getFSRPerformanceData(
  dateRange?: DateRange,
): Promise<FSRPerformanceData[]> {
  await requirePermission("reports:view");

  const startRange = dateRange?.startDate
    ? mxDayRange(dateRange.startDate)
    : mxDayRange(mxDaysAgoString(30));
  const endRange = dateRange?.endDate
    ? mxDayRange(dateRange.endDate)
    : mxDayRange(mxTodayString());
  const startDate = startRange.gte;
  const endDate = endRange.lte;

  // Get FSR role
  const fsrRole = await prisma.role.findFirst({
    where: { name: "FSR", active: true },
  });

  if (!fsrRole) return [];

  // Get all FSR users
  const fsrUsers = await prisma.user.findMany({
    where: {
      roleId: fsrRole.id,
      active: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  // Get performance data for each FSR
  const performanceData: FSRPerformanceData[] = await Promise.all(
    fsrUsers.map(async (fsr) => {
      const assignments = await prisma.assignment.findMany({
        where: {
          assignees: {
            some: { userId: fsr.id, active: true },
          },
          active: true,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          status: true,
          assignmentActivities: {
            where: { active: true },
          },
        },
      });

      const completedAssignments = assignments.filter(
        (a) => a.status?.name === "CERRADO" || a.finishedAt,
      );

      let totalCompletionTime = 0;
      completedAssignments.forEach((a) => {
        if (a.startedAt && a.finishedAt) {
          totalCompletionTime +=
            (a.finishedAt.getTime() - a.startedAt.getTime()) / (1000 * 60 * 60);
        }
      });

      // Get vehicle trips
      const trips = await prisma.vehicleTrip.findMany({
        where: {
          fsrId: fsr.id,
          active: true,
          startedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          kmDriven: true,
        },
      });

      const totalKmDriven = trips.reduce(
        (sum, trip) => sum + (trip.kmDriven || 0),
        0,
      );

      const totalActivities = assignments.reduce(
        (sum, a) => sum + a.assignmentActivities.length,
        0,
      );

      return {
        fsrId: fsr.id,
        fsrName: fsr.name,
        totalAssignments: assignments.length,
        completedAssignments: completedAssignments.length,
        averageCompletionTime:
          completedAssignments.length > 0
            ? totalCompletionTime / completedAssignments.length
            : 0,
        totalActivities,
        totalTrips: trips.length,
        totalKmDriven,
      };
    }),
  );

  return performanceData.sort(
    (a, b) => b.completedAssignments - a.completedAssignments,
  );
}

/**
 * Get Work Order Status Distribution
 */
export async function getAssignmentStatusData(
  dateRange?: DateRange,
): Promise<AssignmentStatusData[]> {
  await requirePermission("reports:view");

  const startRange = dateRange?.startDate
    ? mxDayRange(dateRange.startDate)
    : mxDayRange(mxDaysAgoString(30));
  const endRange = dateRange?.endDate
    ? mxDayRange(dateRange.endDate)
    : mxDayRange(mxTodayString());
  const startDate = startRange.gte;
  const endDate = endRange.lte;

  const assignments = await prisma.assignment.findMany({
    where: {
      active: true,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      status: true,
    },
  });

  const statusCounts: Record<string, number> = {};
  assignments.forEach((a) => {
    const statusName = a.status?.name || "Sin Estado";
    statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
  });

  const total = assignments.length || 1;
  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    percentage: Math.round((count / total) * 100),
  }));
}

/**
 * Get Incident Trend Data (daily counts)
 */
export async function getIncidentTrendData(
  dateRange?: DateRange,
  typeIds?: number[],
): Promise<IncidentTrendData[]> {
  await requirePermission("reports:view");

  const startRange = dateRange?.startDate
    ? mxDayRange(dateRange.startDate)
    : mxDayRange(mxDaysAgoString(30));
  const endRange = dateRange?.endDate
    ? mxDayRange(dateRange.endDate)
    : mxDayRange(mxTodayString());
  const startDate = startRange.gte;
  const endDate = endRange.lte;

  const incidents = await prisma.incident.findMany({
    where: {
      active: true,
      reportedAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(typeIds && typeIds.length > 0 ? { typeId: { in: typeIds } } : {}),
    },
    select: {
      reportedAt: true,
      resolvedAt: true,
    },
  });

  // Group by date
  const trendByDate: Record<string, { count: number; resolved: number }> = {};

  incidents.forEach((incident) => {
    const dateStr = mxDateString(incident.reportedAt);
    if (!trendByDate[dateStr]) {
      trendByDate[dateStr] = { count: 0, resolved: 0 };
    }
    trendByDate[dateStr].count++;
    if (incident.resolvedAt) {
      trendByDate[dateStr].resolved++;
    }
  });

  // Sort by date and return
  return Object.entries(trendByDate)
    .map(([date, data]) => ({
      date,
      count: data.count,
      resolved: data.resolved,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get Incidents by Type Distribution
 */
export async function getIncidentsByTypeData(
  dateRange?: DateRange,
  typeIds?: number[],
): Promise<IncidentByTypeData[]> {
  await requirePermission("reports:view");

  const startRange = dateRange?.startDate
    ? mxDayRange(dateRange.startDate)
    : mxDayRange(mxDaysAgoString(30));
  const endRange = dateRange?.endDate
    ? mxDayRange(dateRange.endDate)
    : mxDayRange(mxTodayString());
  const startDate = startRange.gte;
  const endDate = endRange.lte;

  const incidents = await prisma.incident.findMany({
    where: {
      active: true,
      reportedAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(typeIds && typeIds.length > 0 ? { typeId: { in: typeIds } } : {}),
    },
    include: {
      type: true,
    },
  });

  // Group by type, accumulate priority from the first incident of each type
  const typeCounts: Record<string, { count: number; priority: number }> = {};
  incidents.forEach((incident) => {
    const typeName = incident.type?.name || "Sin Tipo";
    const typePriority = incident.type?.priority ?? 5;
    if (!typeCounts[typeName]) {
      typeCounts[typeName] = { count: 0, priority: typePriority };
    }
    typeCounts[typeName].count++;
  });

  const total = incidents.length || 1;
  return Object.entries(typeCounts).map(([type, data]) => ({
    type,
    priority: data.priority,
    count: data.count,
    percentage: Math.round((data.count / total) * 100),
  }));
}

/**
 * Get Vehicle Trip Data (daily)
 */
export async function getVehicleTripTrendData(
  dateRange?: DateRange,
): Promise<VehicleTripData[]> {
  await requirePermission("reports:view");

  const startRange = dateRange?.startDate
    ? mxDayRange(dateRange.startDate)
    : mxDayRange(mxDaysAgoString(30));
  const endRange = dateRange?.endDate
    ? mxDayRange(dateRange.endDate)
    : mxDayRange(mxTodayString());
  const startDate = startRange.gte;
  const endDate = endRange.lte;

  const trips = await prisma.vehicleTrip.findMany({
    where: {
      active: true,
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      startedAt: true,
      kmDriven: true,
    },
  });

  // Group by date
  const tripsByDate: Record<string, { trips: number; totalKm: number }> = {};

  trips.forEach((trip) => {
    const dateStr = mxDateString(trip.startedAt);
    if (!tripsByDate[dateStr]) {
      tripsByDate[dateStr] = { trips: 0, totalKm: 0 };
    }
    tripsByDate[dateStr].trips++;
    tripsByDate[dateStr].totalKm += trip.kmDriven || 0;
  });

  return Object.entries(tripsByDate)
    .map(([date, data]) => ({
      date,
      trips: data.trips,
      totalKm: data.totalKm,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get Vehicle Trips by FSR
 */
export async function getVehicleTripsByFSRData(
  dateRange?: DateRange,
): Promise<FSRTripData[]> {
  await requirePermission("reports:view");

  const startRange = dateRange?.startDate
    ? mxDayRange(dateRange.startDate)
    : mxDayRange(mxDaysAgoString(30));
  const endRange = dateRange?.endDate
    ? mxDayRange(dateRange.endDate)
    : mxDayRange(mxTodayString());
  const startDate = startRange.gte;
  const endDate = endRange.lte;

  const trips = await prisma.vehicleTrip.findMany({
    where: {
      active: true,
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      fsr: {
        select: { id: true, name: true },
      },
    },
  });

  // Group by FSR
  const tripsByFSR: Record<
    string,
    { name: string; trips: number; totalKm: number }
  > = {};

  trips.forEach((trip) => {
    const fsrId = trip.fsrId;
    if (!tripsByFSR[fsrId]) {
      tripsByFSR[fsrId] = { name: trip.fsr.name, trips: 0, totalKm: 0 };
    }
    tripsByFSR[fsrId].trips++;
    tripsByFSR[fsrId].totalKm += trip.kmDriven || 0;
  });

  return Object.entries(tripsByFSR)
    .map(([fsrId, data]) => ({
      fsrId,
      fsrName: data.name,
      trips: data.trips,
      totalKm: data.totalKm,
      averageKm: data.trips > 0 ? Math.round(data.totalKm / data.trips) : 0,
    }))
    .sort((a, b) => b.totalKm - a.totalKm);
}

/**
 * Get Parts Usage Data
 */
export async function getPartsUsageData(
  dateRange?: DateRange,
): Promise<PartUsageData[]> {
  await requirePermission("reports:view");

  const startRange = dateRange?.startDate
    ? mxDayRange(dateRange.startDate)
    : mxDayRange(mxDaysAgoString(30));
  const endRange = dateRange?.endDate
    ? mxDayRange(dateRange.endDate)
    : mxDayRange(mxTodayString());
  const startDate = startRange.gte;
  const endDate = endRange.lte;

  // Get all work parts with their part info
  const workParts = await prisma.workPart.findMany({
    where: {
      active: true,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      part: true,
    },
  });

  // Group by part
  const partUsage: Record<
    string,
    { name: string; totalUsed: number; totalCost: number; stock: number }
  > = {};

  workParts.forEach((wp) => {
    const partId = wp.partId;
    if (!partUsage[partId]) {
      partUsage[partId] = {
        name: wp.part.name,
        totalUsed: 0,
        totalCost: 0,
        stock: wp.part.stock,
      };
    }
    partUsage[partId].totalUsed += wp.quantity;
    partUsage[partId].totalCost += wp.price * wp.quantity;
  });

  return Object.entries(partUsage)
    .map(([partId, data]) => ({
      partId,
      partName: data.name,
      totalUsed: data.totalUsed,
      totalCost: Math.round(data.totalCost * 100) / 100,
      currentStock: data.stock,
    }))
    .sort((a, b) => b.totalUsed - a.totalUsed);
}

/**
 * Get Report Summary Statistics
 */
export async function getReportSummary(dateRange?: DateRange) {
  await requirePermission("reports:view");

  const startRange = dateRange?.startDate
    ? mxDayRange(dateRange.startDate)
    : mxDayRange(mxDaysAgoString(30));
  const endRange = dateRange?.endDate
    ? mxDayRange(dateRange.endDate)
    : mxDayRange(mxTodayString());
  const startDate = startRange.gte;
  const endDate = endRange.lte;

  // Parallel queries for summary stats
  const [
    totalIncidents,
    resolvedIncidents,
    totalAssignments,
    completedAssignments,
    totalTrips,
    totalKmDriven,
    partsUsed,
  ] = await Promise.all([
    prisma.incident.count({
      where: {
        active: true,
        reportedAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.incident.count({
      where: {
        active: true,
        reportedAt: { gte: startDate, lte: endDate },
        resolvedAt: { not: null },
      },
    }),
    prisma.assignment.count({
      where: {
        active: true,
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.assignment.count({
      where: {
        active: true,
        createdAt: { gte: startDate, lte: endDate },
        finishedAt: { not: null },
      },
    }),
    prisma.vehicleTrip.count({
      where: {
        active: true,
        startedAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.vehicleTrip.aggregate({
      _sum: { kmDriven: true },
      where: {
        active: true,
        startedAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.workPart.aggregate({
      _sum: { quantity: true },
      where: {
        active: true,
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  return {
    totalIncidents,
    resolvedIncidents,
    incidentResolutionRate:
      totalIncidents > 0
        ? Math.round((resolvedIncidents / totalIncidents) * 100)
        : 0,
    totalAssignments,
    completedAssignments,
    assignmentCompletionRate:
      totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0,
    totalTrips,
    totalKmDriven: totalKmDriven._sum.kmDriven || 0,
    totalPartsUsed: partsUsed._sum.quantity || 0,
  };
}

// ============================================
// ASSIGNMENT AGING REPORT
// ============================================

export type AssignmentAgingData = {
  assignmentId: string;
  folio: number;
  incidentTitle: string;
  assignedTo: string;
  status: string;
  createdAt: string;
  ageInDays: number;
  ageBucket: string;
  lastActivity: string | null;
};

export type AgingSummary = {
  total: number;
  byBucket: Array<{
    bucket: string;
    count: number;
    percentage: number;
  }>;
  avgAge: number;
  oldestAssignment: number;
};

const AGE_BUCKETS = [
  { name: "0-7 dias", min: 0, max: 7 },
  { name: "8-14 dias", min: 8, max: 14 },
  { name: "15-30 dias", min: 15, max: 30 },
  { name: "31-60 dias", min: 31, max: 60 },
  { name: "60+ dias", min: 61, max: Infinity },
];

function getAgeBucket(days: number): string {
  const bucket = AGE_BUCKETS.find((b) => days >= b.min && days <= b.max);
  return bucket?.name || "60+ dias";
}

/**
 * Get Assignment Aging Report Data
 */
export async function getAssignmentAgingData(): Promise<{
  assignments: AssignmentAgingData[];
  summary: AgingSummary;
}> {
  await requirePermission("reports:view");

  const assignments = await prisma.assignment.findMany({
    where: {
      active: true,
      finishedAt: null,
    },
    include: {
      incident: {
        select: { title: true },
      },
      assignees: {
        where: { active: true },
        include: {
          user: { select: { name: true } },
        },
      },
      status: true,
      assignmentActivities: {
        where: { active: true },
        orderBy: { performedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const bucketCounts: Record<string, number> = {};
  AGE_BUCKETS.forEach((b) => {
    bucketCounts[b.name] = 0;
  });

  let totalAge = 0;
  let oldestAge = 0;

  const agingData: AssignmentAgingData[] = assignments.map((a) => {
    const ageInMs = now.getTime() - a.createdAt.getTime();
    const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
    const ageBucket = getAgeBucket(ageInDays);

    bucketCounts[ageBucket]++;
    totalAge += ageInDays;
    if (ageInDays > oldestAge) oldestAge = ageInDays;

    const lastActivity =
      a.assignmentActivities.length > 0
        ? a.assignmentActivities[0].performedAt.toISOString()
        : null;

    return {
      assignmentId: a.id,
      folio: a.folio,
      incidentTitle: a.incident.title,
      assignedTo:
        a.assignees.map((aa) => aa.user.name).join(", ") || "Sin asignar",
      status: a.status?.name || "Sin Estado",
      createdAt: a.createdAt.toISOString(),
      ageInDays,
      ageBucket,
      lastActivity,
    };
  });

  const total = assignments.length || 1;
  const summary: AgingSummary = {
    total: assignments.length,
    byBucket: AGE_BUCKETS.map((b) => ({
      bucket: b.name,
      count: bucketCounts[b.name],
      percentage: Math.round((bucketCounts[b.name] / total) * 100),
    })),
    avgAge:
      assignments.length > 0 ? Math.round(totalAge / assignments.length) : 0,
    oldestAssignment: oldestAge,
  };

  return { assignments: agingData, summary };
}

// ============================================
// TIME-TO-SEEN REPORT  (formerly "unlock" — see state machine v1)
// ============================================

export type SeenTimeData = {
  assignmentId: string;
  folio: number;
  incidentTitle: string;
  fsrName: string;
  assignedAt: string | null;
  seenAt: string | null;
  timeToSeenMinutes: number | null;
  status: string;
  isSeen: boolean;
};

export type SeenTimeSummary = {
  totalAssignments: number;
  seenCount: number;
  pendingSeenCount: number;
  seenRate: number;
  avgTimeToSeen: number; // in minutes
  medianTimeToSeen: number;
  byFSR: Array<{
    fsrId: string;
    fsrName: string;
    totalAssigned: number;
    seen: number;
    avgTimeMinutes: number;
  }>;
};

/**
 * Get Time-to-Seen Report Data
 */
export async function getSeenTimeData(
  dateRange?: DateRange,
): Promise<{ assignments: SeenTimeData[]; summary: SeenTimeSummary }> {
  await requirePermission("reports:view");

  const startRange = dateRange?.startDate
    ? mxDayRange(dateRange.startDate)
    : mxDayRange(mxDaysAgoString(30));
  const endRange = dateRange?.endDate
    ? mxDayRange(dateRange.endDate)
    : mxDayRange(mxTodayString());
  const startDate = startRange.gte;
  const endDate = endRange.lte;

  const assignments = await prisma.assignment.findMany({
    where: {
      active: true,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      incident: {
        select: { title: true },
      },
      assignees: {
        where: { active: true },
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const seenTimes: number[] = [];
  const fsrStats: Record<
    string,
    { name: string; total: number; seen: number; totalTime: number }
  > = {};

  const seenData: SeenTimeData[] = assignments.flatMap((a) => {
    const activeAssignees = a.assignees;
    if (activeAssignees.length === 0) return [];

    let timeToSeenMinutes: number | null = null;
    const isSeen = a.seenAt !== null;

    if (a.assignedAt && a.seenAt) {
      timeToSeenMinutes = Math.round(
        (a.seenAt.getTime() - a.assignedAt.getTime()) / (1000 * 60),
      );
    }

    return activeAssignees.map((aa) => {
      const fsrId = aa.user.id;
      if (!fsrStats[fsrId]) {
        fsrStats[fsrId] = {
          name: aa.user.name,
          total: 0,
          seen: 0,
          totalTime: 0,
        };
      }
      fsrStats[fsrId].total++;

      if (timeToSeenMinutes !== null) {
        seenTimes.push(timeToSeenMinutes);
        fsrStats[fsrId].seen++;
        fsrStats[fsrId].totalTime += timeToSeenMinutes;
      }

      return {
        assignmentId: a.id,
        folio: a.folio,
        incidentTitle: a.incident.title,
        fsrName: aa.user.name,
        assignedAt: a.assignedAt?.toISOString() || null,
        seenAt: a.seenAt?.toISOString() || null,
        timeToSeenMinutes,
        status: a.status?.name || "Sin Estado",
        isSeen,
      };
    });
  });

  // Calculate median
  const sortedTimes = [...seenTimes].sort((a, b) => a - b);
  const medianTime =
    sortedTimes.length > 0
      ? sortedTimes.length % 2 === 0
        ? (sortedTimes[sortedTimes.length / 2 - 1] +
            sortedTimes[sortedTimes.length / 2]) /
          2
        : sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0;

  const seenCount = seenTimes.length;
  const avgTime =
    seenCount > 0
      ? Math.round(seenTimes.reduce((a, b) => a + b, 0) / seenCount)
      : 0;

  const summary: SeenTimeSummary = {
    totalAssignments: assignments.length,
    seenCount,
    pendingSeenCount: assignments.length - seenCount,
    seenRate:
      assignments.length > 0
        ? Math.round((seenCount / assignments.length) * 100)
        : 0,
    avgTimeToSeen: avgTime,
    medianTimeToSeen: Math.round(medianTime),
    byFSR: Object.entries(fsrStats)
      .map(([fsrId, stats]) => ({
        fsrId,
        fsrName: stats.name,
        totalAssigned: stats.total,
        seen: stats.seen,
        avgTimeMinutes:
          stats.seen > 0 ? Math.round(stats.totalTime / stats.seen) : 0,
      }))
      .sort((a, b) => a.avgTimeMinutes - b.avgTimeMinutes),
  };

  return { assignments: seenData, summary };
}

// ============================================
// NOTIFICATION ENGAGEMENT REPORT
// ============================================

export type NotificationEngagementRow = {
  userId: string;
  userName: string;
  userEmail: string;
  totalNotifications: number;
  readCount: number;
  unreadCount: number;
  readRatePct: number | null;
  criticalUnreadCount: number;
  lastReadAt: string | null;
  oldestUnreadCreatedAt: string | null;
  oldestUnreadDays: number | null;
};

export type NotificationEngagementSummary = {
  totalNotifications: number;
  totalRead: number;
  totalUnread: number;
  fsrsWithUnread: number;
  fsrsWithCriticalUnread: number;
  overallReadRatePct: number;
};

export async function getNotificationEngagementReport(
  dateRange?: DateRange,
): Promise<{
  rows: NotificationEngagementRow[];
  summary: NotificationEngagementSummary;
}> {
  await requirePermission("reports:view");

  const startDate = dateRange?.startDate
    ? moment.tz(dateRange.startDate, APP_TZ).startOf("day").toDate()
    : moment().tz(APP_TZ).subtract(30, "days").startOf("day").toDate();
  const endDate = dateRange?.endDate
    ? moment.tz(dateRange.endDate, APP_TZ).endOf("day").toDate()
    : moment().tz(APP_TZ).endOf("day").toDate();

  const fsrRole = await prisma.role.findFirst({
    where: { name: "FSR", active: true },
  });
  if (!fsrRole) {
    return {
      rows: [],
      summary: {
        totalNotifications: 0,
        totalRead: 0,
        totalUnread: 0,
        fsrsWithUnread: 0,
        fsrsWithCriticalUnread: 0,
        overallReadRatePct: 0,
      },
    };
  }

  const fsrUsers = await prisma.user.findMany({
    where: { roleId: fsrRole.id, active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const rows: NotificationEngagementRow[] = await Promise.all(
    fsrUsers.map(async (user) => {
      const notifications = await prisma.notification.findMany({
        where: {
          userId: user.id,
          active: true,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          isRead: true,
          readAt: true,
          createdAt: true,
          priority: true,
        },
      });

      const readCount = notifications.filter((n) => n.isRead).length;
      const unreadCount = notifications.length - readCount;
      const criticalUnreadCount = notifications.filter(
        (n) => !n.isRead && n.priority >= 3,
      ).length;
      const lastReadAt = notifications
        .filter((n) => n.readAt)
        .map((n) => n.readAt as Date)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const oldestUnread = notifications
        .filter((n) => !n.isRead)
        .map((n) => n.createdAt)
        .sort((a, b) => a.getTime() - b.getTime())[0];

      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        totalNotifications: notifications.length,
        readCount,
        unreadCount,
        readRatePct:
          notifications.length > 0
            ? Math.round((readCount / notifications.length) * 100)
            : null,
        criticalUnreadCount,
        lastReadAt: lastReadAt ? lastReadAt.toISOString() : null,
        oldestUnreadCreatedAt: oldestUnread ? oldestUnread.toISOString() : null,
        oldestUnreadDays: oldestUnread
          ? moment().diff(moment(oldestUnread), "days")
          : null,
      };
    }),
  );

  rows.sort((a, b) => b.unreadCount - a.unreadCount);

  const totalNotifications = rows.reduce((s, r) => s + r.totalNotifications, 0);
  const totalRead = rows.reduce((s, r) => s + r.readCount, 0);
  const totalUnread = rows.reduce((s, r) => s + r.unreadCount, 0);

  const summary: NotificationEngagementSummary = {
    totalNotifications,
    totalRead,
    totalUnread,
    fsrsWithUnread: rows.filter((r) => r.unreadCount > 0).length,
    fsrsWithCriticalUnread: rows.filter((r) => r.criticalUnreadCount > 0)
      .length,
    overallReadRatePct:
      totalNotifications > 0
        ? Math.round((totalRead / totalNotifications) * 100)
        : 0,
  };

  return { rows, summary };
}

// ============================================
// DAILY TRIP COMPLIANCE REPORT
// ============================================

export type DailyTripComplianceCell = {
  reported: boolean;
  tripCount: number;
  kmDriven: number;
};

export type DailyTripComplianceRow = {
  userId: string;
  userName: string;
  userEmail: string;
  daysReported: number;
  daysMissed: number;
  totalDays: number;
  complianceRatePct: number;
  byDay: Record<string, DailyTripComplianceCell>;
  lastTripAt: string | null;
  reportedToday: boolean;
};

export type DailyTripComplianceSummary = {
  totalFsrs: number;
  fullyCompliant: number;
  missedToday: number;
  averageComplianceRate: number;
};

export async function getDailyTripComplianceReport(
  dateRange?: DateRange,
): Promise<{
  days: string[];
  rows: DailyTripComplianceRow[];
  summary: DailyTripComplianceSummary;
}> {
  await requirePermission("reports:view");

  const start = dateRange?.startDate
    ? moment.tz(dateRange.startDate, APP_TZ).startOf("day")
    : moment().tz(APP_TZ).subtract(6, "days").startOf("day");
  const end = dateRange?.endDate
    ? moment.tz(dateRange.endDate, APP_TZ).endOf("day")
    : moment().tz(APP_TZ).endOf("day");

  const days: string[] = [];
  const iter = start.clone();
  while (iter.isSameOrBefore(end, "day")) {
    days.push(iter.format("YYYY-MM-DD"));
    iter.add(1, "day");
  }

  const fsrRole = await prisma.role.findFirst({
    where: { name: "FSR", active: true },
  });
  if (!fsrRole) {
    return {
      days,
      rows: [],
      summary: {
        totalFsrs: 0,
        fullyCompliant: 0,
        missedToday: 0,
        averageComplianceRate: 0,
      },
    };
  }

  const fsrUsers = await prisma.user.findMany({
    where: { roleId: fsrRole.id, active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const fsrIds = fsrUsers.map((u) => u.id);

  const trips =
    fsrIds.length === 0
      ? []
      : await prisma.vehicleTrip.findMany({
          where: {
            active: true,
            fsrId: { in: fsrIds },
            startedAt: { gte: start.toDate(), lte: end.toDate() },
          },
          select: {
            fsrId: true,
            startedAt: true,
            kmDriven: true,
          },
        });

  const today = moment().tz(APP_TZ).format("YYYY-MM-DD");

  const rows: DailyTripComplianceRow[] = fsrUsers.map((user) => {
    const byDay: Record<string, DailyTripComplianceCell> = {};
    for (const day of days) {
      byDay[day] = { reported: false, tripCount: 0, kmDriven: 0 };
    }

    const userTrips = trips.filter((t) => t.fsrId === user.id);
    let lastTripAt: Date | null = null;

    for (const trip of userTrips) {
      const day = moment(trip.startedAt).tz(APP_TZ).format("YYYY-MM-DD");
      if (byDay[day]) {
        byDay[day].reported = true;
        byDay[day].tripCount += 1;
        byDay[day].kmDriven += trip.kmDriven || 0;
      }
      if (!lastTripAt || trip.startedAt > lastTripAt) {
        lastTripAt = trip.startedAt;
      }
    }

    const daysReported = Object.values(byDay).filter((c) => c.reported).length;
    const totalDays = days.length;
    const reportedToday =
      days.includes(today) && byDay[today]?.reported === true;

    return {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      daysReported,
      daysMissed: totalDays - daysReported,
      totalDays,
      complianceRatePct:
        totalDays > 0 ? Math.round((daysReported / totalDays) * 100) : 0,
      byDay,
      lastTripAt: lastTripAt ? lastTripAt.toISOString() : null,
      reportedToday,
    };
  });

  const summary: DailyTripComplianceSummary = {
    totalFsrs: rows.length,
    fullyCompliant: rows.filter((r) => r.complianceRatePct === 100).length,
    missedToday: days.includes(today)
      ? rows.filter((r) => !r.reportedToday).length
      : 0,
    averageComplianceRate:
      rows.length > 0
        ? Math.round(
            rows.reduce((s, r) => s + r.complianceRatePct, 0) / rows.length,
          )
        : 0,
  };

  return { days, rows, summary };
}
