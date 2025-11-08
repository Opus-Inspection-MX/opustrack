"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { revalidatePath } from "next/cache";

export async function getIncidentsForTracking(filters?: {
  vicId?: string;
  typeId?: number;
  statusId?: number;
  startDate?: string;
  endDate?: string;
  assignedFsrId?: string;
}) {
  try {
    const where: any = {
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
        where.reportedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.reportedAt.lte = new Date(filters.endDate);
      }
    }

    const incidents = await prisma.incident.findMany({
      where,
      include: {
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
          },
        },
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        workOrders: {
          where: { active: true },
          include: {
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
    });

    // Filter by assigned FSR if specified
    if (filters?.assignedFsrId) {
      return incidents.filter((incident) =>
        incident.workOrders.some(
          (wo) => wo.assignedTo.id === filters.assignedFsrId
        )
      );
    }

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
        vicId,
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

export async function updateWorkOrderFSR(workOrderId: number, fsrId: string) {
  try {
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        assignedToId: fsrId,
      },
    });

    revalidatePath("/admin/tracking");
    return { success: true };
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
  }
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
      },
    });

    revalidatePath("/admin/tracking");
    return { success: true };
  } catch (error) {
    console.error("Error updating incident:", error);
    throw new Error("Failed to update incident");
  }
}
