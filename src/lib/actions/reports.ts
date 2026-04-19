"use server";

import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type FSRPerformanceData = {
  fsrId: string;
  fsrName: string;
  totalWorkOrders: number;
  completedWorkOrders: number;
  averageCompletionTime: number; // in hours
  totalActivities: number;
  totalTrips: number;
  totalKmDriven: number;
};

export type WorkOrderStatusData = {
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

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

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
      // Get work orders
      const workOrders = await prisma.workOrder.findMany({
        where: {
          assignedToId: fsr.id,
          active: true,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          status: true,
          workActivities: {
            where: { active: true },
          },
        },
      });

      // Calculate completion time for completed work orders
      const completedWorkOrders = workOrders.filter(
        (wo) => wo.status?.name === "COMPLETADO" || wo.finishedAt,
      );

      let totalCompletionTime = 0;
      completedWorkOrders.forEach((wo) => {
        if (wo.startedAt && wo.finishedAt) {
          totalCompletionTime +=
            (wo.finishedAt.getTime() - wo.startedAt.getTime()) /
            (1000 * 60 * 60);
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

      const totalActivities = workOrders.reduce(
        (sum, wo) => sum + wo.workActivities.length,
        0,
      );

      return {
        fsrId: fsr.id,
        fsrName: fsr.name,
        totalWorkOrders: workOrders.length,
        completedWorkOrders: completedWorkOrders.length,
        averageCompletionTime:
          completedWorkOrders.length > 0
            ? totalCompletionTime / completedWorkOrders.length
            : 0,
        totalActivities,
        totalTrips: trips.length,
        totalKmDriven,
      };
    }),
  );

  return performanceData.sort(
    (a, b) => b.completedWorkOrders - a.completedWorkOrders,
  );
}

/**
 * Get Work Order Status Distribution
 */
export async function getWorkOrderStatusData(
  dateRange?: DateRange,
): Promise<WorkOrderStatusData[]> {
  await requirePermission("reports:view");

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

  const workOrders = await prisma.workOrder.findMany({
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

  // Group by status
  const statusCounts: Record<string, number> = {};
  workOrders.forEach((wo) => {
    const statusName = wo.status?.name || "Sin Estado";
    statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
  });

  const total = workOrders.length || 1;
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
): Promise<IncidentTrendData[]> {
  await requirePermission("reports:view");

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

  const incidents = await prisma.incident.findMany({
    where: {
      active: true,
      reportedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      reportedAt: true,
      resolvedAt: true,
    },
  });

  // Group by date
  const trendByDate: Record<string, { count: number; resolved: number }> = {};

  incidents.forEach((incident) => {
    const dateStr = incident.reportedAt.toISOString().split("T")[0];
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
): Promise<IncidentByTypeData[]> {
  await requirePermission("reports:view");

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

  const incidents = await prisma.incident.findMany({
    where: {
      active: true,
      reportedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      type: true,
    },
  });

  // Group by type
  const typeCounts: Record<string, number> = {};
  incidents.forEach((incident) => {
    const typeName = incident.type?.name || "Sin Tipo";
    typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
  });

  const total = incidents.length || 1;
  return Object.entries(typeCounts).map(([type, count]) => ({
    type,
    count,
    percentage: Math.round((count / total) * 100),
  }));
}

/**
 * Get Vehicle Trip Data (daily)
 */
export async function getVehicleTripTrendData(
  dateRange?: DateRange,
): Promise<VehicleTripData[]> {
  await requirePermission("reports:view");

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

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
    const dateStr = trip.startedAt.toISOString().split("T")[0];
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

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

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

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

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

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

  // Parallel queries for summary stats
  const [
    totalIncidents,
    resolvedIncidents,
    totalWorkOrders,
    completedWorkOrders,
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
    prisma.workOrder.count({
      where: {
        active: true,
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.workOrder.count({
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
    totalWorkOrders,
    completedWorkOrders,
    workOrderCompletionRate:
      totalWorkOrders > 0
        ? Math.round((completedWorkOrders / totalWorkOrders) * 100)
        : 0,
    totalTrips,
    totalKmDriven: totalKmDriven._sum.kmDriven || 0,
    totalPartsUsed: partsUsed._sum.quantity || 0,
  };
}

// ============================================
// SLA COMPLIANCE REPORT
// ============================================

export type SLAComplianceData = {
  incidentId: number;
  title: string;
  priority: number;
  slaHours: number;
  actualHours: number | null;
  isCompliant: boolean;
  status: string;
  reportedAt: string;
  resolvedAt: string | null;
};

export type SLASummary = {
  totalIncidents: number;
  compliantCount: number;
  breachedCount: number;
  pendingCount: number;
  complianceRate: number;
  avgResolutionTime: number;
  byPriority: Array<{
    priority: number;
    total: number;
    compliant: number;
    breached: number;
    complianceRate: number;
  }>;
};

/**
 * Get SLA Compliance Report Data
 */
export async function getSLAComplianceData(
  dateRange?: DateRange,
): Promise<{ incidents: SLAComplianceData[]; summary: SLASummary }> {
  await requirePermission("reports:view");

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

  const incidents = await prisma.incident.findMany({
    where: {
      active: true,
      reportedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      status: true,
    },
    orderBy: { reportedAt: "desc" },
  });

  const now = new Date();
  let compliantCount = 0;
  let breachedCount = 0;
  let pendingCount = 0;
  let totalResolutionTime = 0;
  let resolvedCount = 0;

  // Track by priority
  const priorityStats: Record<
    number,
    { total: number; compliant: number; breached: number }
  > = {};

  const incidentData: SLAComplianceData[] = incidents.map((incident) => {
    const slaHours = incident.sla;
    let actualHours: number | null = null;
    let isCompliant = false;

    // Initialize priority stats
    if (!priorityStats[incident.priority]) {
      priorityStats[incident.priority] = {
        total: 0,
        compliant: 0,
        breached: 0,
      };
    }
    priorityStats[incident.priority].total++;

    if (incident.resolvedAt) {
      // Incident is resolved - calculate actual time
      actualHours =
        (incident.resolvedAt.getTime() - incident.reportedAt.getTime()) /
        (1000 * 60 * 60);
      isCompliant = actualHours <= slaHours;
      totalResolutionTime += actualHours;
      resolvedCount++;

      if (isCompliant) {
        compliantCount++;
        priorityStats[incident.priority].compliant++;
      } else {
        breachedCount++;
        priorityStats[incident.priority].breached++;
      }
    } else {
      // Incident is pending - check if SLA is already breached
      const elapsedHours =
        (now.getTime() - incident.reportedAt.getTime()) / (1000 * 60 * 60);
      actualHours = elapsedHours;

      if (elapsedHours > slaHours) {
        // Already breached
        breachedCount++;
        priorityStats[incident.priority].breached++;
        isCompliant = false;
      } else {
        // Still within SLA
        pendingCount++;
        isCompliant = true; // Currently compliant
      }
    }

    return {
      incidentId: incident.id,
      title: incident.title,
      priority: incident.priority,
      slaHours,
      actualHours:
        actualHours !== null ? Math.round(actualHours * 10) / 10 : null,
      isCompliant,
      status: incident.status?.name || "Sin Estado",
      reportedAt: incident.reportedAt.toISOString(),
      resolvedAt: incident.resolvedAt?.toISOString() || null,
    };
  });

  const summary: SLASummary = {
    totalIncidents: incidents.length,
    compliantCount,
    breachedCount,
    pendingCount,
    complianceRate:
      incidents.length > 0
        ? Math.round(((compliantCount + pendingCount) / incidents.length) * 100)
        : 0,
    avgResolutionTime:
      resolvedCount > 0
        ? Math.round((totalResolutionTime / resolvedCount) * 10) / 10
        : 0,
    byPriority: Object.entries(priorityStats)
      .map(([priority, stats]) => ({
        priority: parseInt(priority),
        total: stats.total,
        compliant: stats.compliant,
        breached: stats.breached,
        complianceRate:
          stats.total > 0
            ? Math.round((stats.compliant / stats.total) * 100)
            : 0,
      }))
      .sort((a, b) => b.priority - a.priority),
  };

  return { incidents: incidentData, summary };
}

// ============================================
// WORK ORDER AGING REPORT
// ============================================

export type WorkOrderAgingData = {
  workOrderId: string;
  folio: string | null;
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
  oldestWorkOrder: number;
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
 * Get Work Order Aging Report Data
 */
export async function getWorkOrderAgingData(): Promise<{
  workOrders: WorkOrderAgingData[];
  summary: AgingSummary;
}> {
  await requirePermission("reports:view");

  // Get all active, non-completed work orders
  const workOrders = await prisma.workOrder.findMany({
    where: {
      active: true,
      finishedAt: null, // Not completed
    },
    include: {
      incident: {
        select: { title: true },
      },
      assignedTo: {
        select: { name: true },
      },
      status: true,
      workActivities: {
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

  const agingData: WorkOrderAgingData[] = workOrders.map((wo) => {
    const ageInMs = now.getTime() - wo.createdAt.getTime();
    const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
    const ageBucket = getAgeBucket(ageInDays);

    bucketCounts[ageBucket]++;
    totalAge += ageInDays;
    if (ageInDays > oldestAge) oldestAge = ageInDays;

    const lastActivity =
      wo.workActivities.length > 0
        ? wo.workActivities[0].performedAt.toISOString()
        : null;

    return {
      workOrderId: wo.id,
      folio: wo.folio,
      incidentTitle: wo.incident.title,
      assignedTo: wo.assignedTo.name,
      status: wo.status?.name || "Sin Estado",
      createdAt: wo.createdAt.toISOString(),
      ageInDays,
      ageBucket,
      lastActivity,
    };
  });

  const total = workOrders.length || 1;
  const summary: AgingSummary = {
    total: workOrders.length,
    byBucket: AGE_BUCKETS.map((b) => ({
      bucket: b.name,
      count: bucketCounts[b.name],
      percentage: Math.round((bucketCounts[b.name] / total) * 100),
    })),
    avgAge:
      workOrders.length > 0 ? Math.round(totalAge / workOrders.length) : 0,
    oldestWorkOrder: oldestAge,
  };

  return { workOrders: agingData, summary };
}

// ============================================
// TIME-TO-UNLOCK REPORT
// ============================================

export type UnlockTimeData = {
  workOrderId: string;
  folio: string | null;
  incidentTitle: string;
  fsrName: string;
  assignedAt: string | null;
  unlockedAt: string | null;
  timeToUnlockMinutes: number | null;
  status: string;
  isUnlocked: boolean;
};

export type UnlockTimeSummary = {
  totalWorkOrders: number;
  unlockedCount: number;
  pendingUnlockCount: number;
  unlockRate: number;
  avgTimeToUnlock: number; // in minutes
  medianTimeToUnlock: number;
  byFSR: Array<{
    fsrId: string;
    fsrName: string;
    totalAssigned: number;
    unlocked: number;
    avgTimeMinutes: number;
  }>;
};

/**
 * Get Time-to-Unlock Report Data
 */
export async function getUnlockTimeData(
  dateRange?: DateRange,
): Promise<{ workOrders: UnlockTimeData[]; summary: UnlockTimeSummary }> {
  await requirePermission("reports:view");

  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();

  const workOrders = await prisma.workOrder.findMany({
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
      assignedTo: {
        select: { id: true, name: true },
      },
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const unlockTimes: number[] = [];
  const fsrStats: Record<
    string,
    { name: string; total: number; unlocked: number; totalTime: number }
  > = {};

  const unlockData: UnlockTimeData[] = workOrders.map((wo) => {
    const fsrId = wo.assignedToId;
    if (!fsrStats[fsrId]) {
      fsrStats[fsrId] = {
        name: wo.assignedTo.name,
        total: 0,
        unlocked: 0,
        totalTime: 0,
      };
    }
    fsrStats[fsrId].total++;

    let timeToUnlockMinutes: number | null = null;
    const isUnlocked = wo.unlockedAt !== null;

    if (wo.assignedAt && wo.unlockedAt) {
      timeToUnlockMinutes = Math.round(
        (wo.unlockedAt.getTime() - wo.assignedAt.getTime()) / (1000 * 60),
      );
      unlockTimes.push(timeToUnlockMinutes);
      fsrStats[fsrId].unlocked++;
      fsrStats[fsrId].totalTime += timeToUnlockMinutes;
    }

    return {
      workOrderId: wo.id,
      folio: wo.folio,
      incidentTitle: wo.incident.title,
      fsrName: wo.assignedTo.name,
      assignedAt: wo.assignedAt?.toISOString() || null,
      unlockedAt: wo.unlockedAt?.toISOString() || null,
      timeToUnlockMinutes,
      status: wo.status?.name || "Sin Estado",
      isUnlocked,
    };
  });

  // Calculate median
  const sortedTimes = [...unlockTimes].sort((a, b) => a - b);
  const medianTime =
    sortedTimes.length > 0
      ? sortedTimes.length % 2 === 0
        ? (sortedTimes[sortedTimes.length / 2 - 1] +
            sortedTimes[sortedTimes.length / 2]) /
          2
        : sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0;

  const unlockedCount = unlockTimes.length;
  const avgTime =
    unlockedCount > 0
      ? Math.round(unlockTimes.reduce((a, b) => a + b, 0) / unlockedCount)
      : 0;

  const summary: UnlockTimeSummary = {
    totalWorkOrders: workOrders.length,
    unlockedCount,
    pendingUnlockCount: workOrders.length - unlockedCount,
    unlockRate:
      workOrders.length > 0
        ? Math.round((unlockedCount / workOrders.length) * 100)
        : 0,
    avgTimeToUnlock: avgTime,
    medianTimeToUnlock: Math.round(medianTime),
    byFSR: Object.entries(fsrStats)
      .map(([fsrId, stats]) => ({
        fsrId,
        fsrName: stats.name,
        totalAssigned: stats.total,
        unlocked: stats.unlocked,
        avgTimeMinutes:
          stats.unlocked > 0 ? Math.round(stats.totalTime / stats.unlocked) : 0,
      }))
      .sort((a, b) => a.avgTimeMinutes - b.avgTimeMinutes),
  };

  return { workOrders: unlockData, summary };
}
