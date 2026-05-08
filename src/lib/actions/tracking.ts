"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

type FolioQuery =
  | { kind: "incident"; value: number }
  | { kind: "assignment"; value: number }
  | { kind: "either"; value: number }
  | { kind: "none" };

function parseFolioQuery(input: string): FolioQuery {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "none" };

  const incMatch = trimmed.match(/^inc[-\s]?(\d+)$/i);
  if (incMatch) return { kind: "incident", value: Number(incMatch[1]) };

  const asMatch = trimmed.match(/^as[-\s]?(\d+)$/i);
  if (asMatch) return { kind: "assignment", value: Number(asMatch[1]) };

  if (/^\d+$/.test(trimmed)) {
    return { kind: "either", value: Number(trimmed) };
  }

  return { kind: "none" };
}

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
    await requirePermission("tracking:read");

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

    const assignmentsWhere: Prisma.AssignmentWhereInput = { active: true };

    if (filters?.assignedFsrId) {
      assignmentsWhere.assignedToId = filters.assignedFsrId;
    }

    if (filters?.folio) {
      const parsed = parseFolioQuery(filters.folio);
      if (parsed.kind === "incident") {
        where.id = parsed.value;
      } else if (parsed.kind === "assignment") {
        assignmentsWhere.folio = parsed.value;
      } else if (parsed.kind === "either") {
        where.OR = [
          { id: parsed.value },
          {
            assignments: { some: { ...assignmentsWhere, folio: parsed.value } },
          },
        ];
      }
    }

    if (
      filters?.assignedFsrId ||
      (filters?.folio && assignmentsWhere.folio !== undefined)
    ) {
      where.assignments = {
        some: assignmentsWhere,
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
        assignments: {
          where: assignmentsWhere,
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
    await requirePermission("tracking:read");

    const users = await prisma.user.findMany({
      where: {
        vicAssignments: {
          some: { vicId, active: true },
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
    await requirePermission("tracking:update");

    const existingAssignment = await prisma.assignment.findFirst({
      where: {
        incidentId,
        active: true,
      },
    });

    if (existingAssignment) {
      await prisma.assignment.update({
        where: { id: existingAssignment.id },
        data: {
          assignedToId: fsrId,
        },
      });
    } else {
      const pendingStatus = await prisma.assignmentStatus.findFirst({
        where: { name: "PENDIENTE" },
      });

      await prisma.assignment.create({
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

export async function updateAssignmentFSR(assignmentId: string, fsrId: string) {
  try {
    await requirePermission("tracking:update");

    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
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
    return { success: true, assignment: updatedAssignment };
  } catch (error) {
    console.error("Error updating assignment FSR:", error);
    throw new Error("Failed to update assignment FSR");
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
    await requirePermission("tracking:update");

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

export async function updateAssignmentDetails(
  assignmentId: string,
  data: {
    assignedToId: string;
    statusId?: number | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  },
) {
  try {
    await requirePermission("tracking:update");

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        assignedToId: data.assignedToId,
        statusId: data.statusId || null,
        startedAt: data.startedAt ? new Date(data.startedAt) : null,
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
      },
    });

    revalidatePath("/admin/tracking");
    return { success: true };
  } catch (error) {
    console.error("Error updating assignment:", error);
    throw new Error("Failed to update assignment");
  }
}
