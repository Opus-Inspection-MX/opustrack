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

const TRACKING_MAX_RESULTS = 200;

export async function getIncidentsForTracking(filters?: {
  clienteId?: string;
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

    if (filters?.clienteId) {
      where.clienteId = filters.clienteId;
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
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.reportedAt.lte = endDate;
      }
    }

    const assignmentsWhere: Prisma.AssignmentWhereInput = { active: true };

    if (filters?.assignedFsrId) {
      assignmentsWhere.assignees = {
        some: { userId: filters.assignedFsrId, active: true },
      };
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

    const incidentSelect = {
      id: true,
      title: true,
      description: true,
      reportedAt: true,
      resolvedAt: true,
      lineId: true,
      equipmentId: true,
      cliente: {
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
      assignees: {
        where: { active: true },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
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
          assignees: {
            where: { active: true },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  roleId: true,
                },
              },
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
    } as const;

    const [totalCount, incidents] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        select: incidentSelect,
        orderBy: {
          reportedAt: "desc",
        },
        take: TRACKING_MAX_RESULTS,
      }),
    ]);

    return { data: incidents, totalCount };
  } catch (error) {
    console.error("Error fetching incidents for tracking:", error);
    throw new Error("Failed to fetch incidents");
  }
}

export async function getFSRsByClienteId(clienteId: string) {
  try {
    await requirePermission("tracking:read");

    const users = await prisma.user.findMany({
      where: {
        clienteAssignments: {
          some: { clienteId, active: true },
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
    console.error("Error fetching FSRs by Cliente:", error);
    throw new Error("Failed to fetch FSRs");
  }
}

export async function assignFSRToIncident(incidentId: number, fsrId: string) {
  try {
    await requirePermission("tracking:update");

    const authorized = await prisma.incidentAssignee.findFirst({
      where: { incidentId, userId: fsrId, active: true },
      select: { id: true },
    });
    if (!authorized) {
      throw new Error(
        "Solo se pueden asignar FSRs habilitados en la incidencia",
      );
    }

    const existingAssignment = await prisma.assignment.findFirst({
      where: {
        incidentId,
        active: true,
      },
    });

    if (existingAssignment) {
      await prisma.assignmentAssignee.upsert({
        where: {
          assignmentId_userId: {
            assignmentId: existingAssignment.id,
            userId: fsrId,
          },
        },
        update: { active: true },
        create: {
          assignmentId: existingAssignment.id,
          userId: fsrId,
          active: true,
        },
      });
    } else {
      const initialStatus = await prisma.assignmentStatus.findFirst({
        where: { name: "ASIGNADO" },
      });

      await prisma.assignment.create({
        data: {
          incidentId,
          statusId: initialStatus?.id,
          assignedAt: new Date(),
          assignees: {
            create: [{ userId: fsrId }],
          },
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

export async function updateAssignmentAssignees(
  assignmentId: string,
  userIds: string[],
) {
  try {
    await requirePermission("tracking:update");

    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    if (uniqueIds.length > 0) {
      const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { incidentId: true },
      });
      if (!assignment) throw new Error("Assignment not found");
      const authorized = await prisma.incidentAssignee.findMany({
        where: {
          incidentId: assignment.incidentId,
          active: true,
          userId: { in: uniqueIds },
        },
        select: { userId: true },
      });
      const authorizedSet = new Set(authorized.map((a) => a.userId));
      const unauthorized = uniqueIds.filter((u) => !authorizedSet.has(u));
      if (unauthorized.length > 0) {
        throw new Error(
          "Solo se pueden asignar FSRs habilitados en la incidencia",
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.assignmentAssignee.findMany({
        where: { assignmentId },
        select: { userId: true, active: true },
      });

      const existingActive = new Set(
        existing.filter((e) => e.active).map((e) => e.userId),
      );
      const requested = new Set(uniqueIds);

      const toRemove = [...existingActive].filter((u) => !requested.has(u));
      const toAdd = uniqueIds.filter((u) => !existingActive.has(u));

      if (toRemove.length > 0) {
        await tx.assignmentAssignee.updateMany({
          where: { assignmentId, userId: { in: toRemove } },
          data: { active: false },
        });
      }

      for (const userId of toAdd) {
        await tx.assignmentAssignee.upsert({
          where: { assignmentId_userId: { assignmentId, userId } },
          update: { active: true },
          create: { assignmentId, userId, active: true },
        });
      }
    });

    const updatedAssignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        assignees: {
          where: { active: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/admin/tracking");
    return { success: true, assignment: updatedAssignment };
  } catch (error) {
    console.error("Error updating assignment assignees:", error);
    throw new Error("Failed to update assignment assignees");
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
