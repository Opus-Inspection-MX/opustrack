"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/database/prisma.singleton";

export async function getIncidentsForTracking(filters?: {
  vicId?: string;
  typeId?: number;
  statusId?: number;
  startDate?: string;
  endDate?: string;
  assignedFsrId?: string;
  folio?: string;
}) {
  try {
    const where: Prisma.IncidentWhereInput = {
      active: true,
    };

    if (filters?.vicId) {
      where.vicId = filters.vicId;
    }

    if (filters?.typeId) {
      where.typeId = filters.typeId;
    }

    if (filters?.statusId) {
      where.statusId = filters.statusId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.reportedAt = {};
      if (filters.startDate) {
        // Set to start of day (00:00:00.000)
        where.reportedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // Set to end of day (23:59:59.999) to include all incidents from that day
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.reportedAt.lte = endDate;
      }
    }

    // Build work orders filter at database level for better performance
    const workOrdersWhere: Prisma.WorkOrderWhereInput = { active: true };

    if (filters?.assignedFsrId) {
      workOrdersWhere.assignedToId = filters.assignedFsrId;
    }

    if (filters?.folio) {
      workOrdersWhere.folio = {
        contains: filters.folio,
        mode: "insensitive",
      };
    }

    // If filtering by FSR or folio, add to incident where clause
    if (filters?.assignedFsrId || filters?.folio) {
      where.workOrders = {
        some: workOrdersWhere,
      };
    }

    const incidents = await prisma.incident.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        sla: true,
        reportedAt: true,
        resolvedAt: true,
        lineId: true,
        equipmentId: true,
        vic: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        type: {
          select: {
            id: true,
            name: true,
          },
        },
        status: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        line: {
          select: {
            id: true,
            name: true,
          },
        },
        workOrders: {
          where: workOrdersWhere,
          select: {
            id: true,
            folio: true,
            notes: true,
            startedAt: true,
            finishedAt: true,
            createdAt: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
                roleId: true,
              },
            },
            status: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        reportedAt: "desc",
      },
      // Add a reasonable limit to prevent loading thousands of records
      take: 500,
    });

    return incidents;
  } catch (error) {
    console.error("Error fetching incidents for tracking:", error);
    throw new Error("Failed to fetch incidents");
  }
}

export async function getFSRsByVicId(vicId: string) {
  try {
    const users = await prisma.user.findMany({
      where: {
        vicIds: {
          has: vicId, // Check if vicId is in the vicIds array
        },
        active: true,
        role: {
          name: "FSR",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return users;
  } catch (error) {
    console.error("Error fetching FSRs by VIC:", error);
    throw new Error("Failed to fetch FSRs");
  }
}

export async function assignFSRToIncident(incidentId: number, fsrId: string) {
  try {
    // Check if there's already a work order for this incident
    const existingWorkOrder = await prisma.workOrder.findFirst({
      where: {
        incidentId,
        active: true,
      },
    });

    if (existingWorkOrder) {
      // Update the existing work order
      await prisma.workOrder.update({
        where: { id: existingWorkOrder.id },
        data: {
          assignedToId: fsrId,
        },
      });
    } else {
      // Create a new work order
      // Get the default status for new work orders (PENDING)
      const pendingStatus = await prisma.incidentStatus.findFirst({
        where: { name: "PENDING" },
      });

      await prisma.workOrder.create({
        data: {
          incidentId,
          assignedToId: fsrId,
          statusId: pendingStatus?.id,
        },
      });
    }

    revalidatePath("/admin/tracking");
    return { success: true };
  } catch (error) {
    console.error("Error assigning FSR to incident:", error);
    throw new Error("Failed to assign FSR");
  }
}

export async function updateWorkOrderFSR(workOrderId: string, fsrId: string) {
  try {
    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        assignedToId: fsrId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    revalidatePath("/admin/tracking");
    return { success: true, workOrder: updatedWorkOrder };
  } catch (error) {
    console.error("Error updating work order FSR:", error);
    throw new Error("Failed to update work order FSR");
  }
}

export async function updateIncidentDetails(
  incidentId: number,
  data: {
    title: string;
    description: string;
    reportedAt: string;
    resolvedAt?: string | null;
    statusId: number;
    lineId?: number | null;
    equipmentId?: number | null;
  },
) {
  try {
    await prisma.incident.update({
      where: { id: incidentId },
      data: {
        title: data.title,
        description: data.description,
        reportedAt: new Date(data.reportedAt),
        resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : null,
        statusId: data.statusId,
        lineId: data.lineId || null,
        equipmentId: data.equipmentId || null,
      },
    });

    revalidatePath("/admin/tracking");
    return { success: true };
  } catch (error) {
    console.error("Error updating incident:", error);
    throw new Error("Failed to update incident");
  }
}

export async function updateWorkOrderDetails(
  workOrderId: string,
  data: {
    assignedToId: string;
    statusId?: number | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    folio?: string | null;
  },
) {
  try {
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        assignedToId: data.assignedToId,
        statusId: data.statusId || null,
        startedAt: data.startedAt ? new Date(data.startedAt) : null,
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
        folio: data.folio || null,
      },
    });

    revalidatePath("/admin/tracking");
    return { success: true };
  } catch (error) {
    console.error("Error updating work order:", error);
    throw new Error("Failed to update work order");
  }
}
