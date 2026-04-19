"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { assertVicAccess, getVicWhereClause } from "@/lib/auth/filters";
import { prisma } from "@/lib/database/prisma.singleton";
import { getPrimaryVicId } from "@/lib/utils/vic-assignments";
import {
  IncidentClientCreateSchema,
  type IncidentCreateInput,
  IncidentCreateSchema,
} from "@/lib/validations/incidents";

// Keep legacy type for backward compatibility with existing forms
export type IncidentFormData = IncidentCreateInput;

/**
 * Get all incidents with relations
 * Filtered by user's VIC (except ADMINISTRADOR who sees all)
 */
export async function getIncidents() {
  const user = await requirePermission("incidents:read");
  const vicFilter = getVicWhereClause(user);

  const incidents = await prisma.incident.findMany({
    where: {
      active: true,
      ...vicFilter, // Apply VIC filter
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      schedule: true,
      _count: {
        select: { workOrders: true },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  return incidents;
}

/**
 * Get incidents related to FSR's assigned work orders
 */
export async function getMyIncidents() {
  const user = await requirePermission("incidents:read");

  const incidents = await prisma.incident.findMany({
    where: {
      active: true,
      workOrders: {
        some: {
          assignedToId: user.id,
          active: true,
        },
      },
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: { workOrders: true },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  return incidents;
}

/**
 * Get single incident by ID
 * Verifies user has access to the incident's VIC
 */
export async function getIncidentById(id: number) {
  const user = await requirePermission("incidents:read");

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      schedule: true,
      workOrders: {
        where: { active: true },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          status: true,
          _count: {
            select: {
              workActivities: true,
              workParts: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!incident) {
    throw new Error("Incident not found");
  }

  // Verify user has access to this incident's VIC
  assertVicAccess(user, incident.vicId);

  return incident;
}

/**
 * Create new incident
 * Validates input with Zod schema
 */
export async function createIncident(data: unknown) {
  const user = await requirePermission("incidents:create");

  // Validate input
  const validated = IncidentCreateSchema.parse(data);

  const incident = await prisma.incident.create({
    data: {
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      sla: validated.sla,
      typeId: validated.typeId || null,
      statusId: validated.statusId || null,
      vicId: validated.vicId || null,
      scheduleId: validated.scheduleId || null,
      reportedById: validated.reportedById || user.id, // Use current user if not specified
      resolvedAt: validated.resolvedAt || null,
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: true,
    },
  });

  revalidatePath("/admin/incidents");
  revalidatePath("/client/incidents");
  return { success: true, data: incident };
}

/**
 * Create incident as client (simplified for client role)
 * Validates input with Zod schema
 */
export async function createIncidentAsClient(data: unknown) {
  const user = await requirePermission("incidents:create");

  // Validate input
  const validated = IncidentClientCreateSchema.parse(data);

  // Get ABIERTO status
  const openStatus = await prisma.incidentStatus.findFirst({
    where: { name: "ABIERTO" },
  });

  if (!openStatus) {
    throw new Error("Estado ABIERTO no encontrado");
  }

  // Client must have a VIC assigned
  const userVicId = await getPrimaryVicId(user.id);
  if (!userVicId) {
    throw new Error("El usuario no tiene un VIC asignado");
  }

  const incident = await prisma.incident.create({
    data: {
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      sla: 24, // Default SLA for client incidents
      typeId: validated.typeId || null,
      statusId: openStatus.id,
      vicId: userVicId,
      reportedById: user.id,
      lineId: validated.lineId || null,
      equipmentId: validated.equipmentId || null,
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  revalidatePath("/client/incidents");
  revalidatePath("/admin/incidents");
  return { success: true, data: incident };
}

/**
 * Get incidents for client (only their VIC)
 */
export async function getClientIncidents() {
  const user = await requirePermission("incidents:read");

  const userVicId = await getPrimaryVicId(user.id);
  if (!userVicId) {
    return [];
  }

  // Client users should only see incidents they reported themselves
  const incidents = await prisma.incident.findMany({
    where: {
      reportedById: user.id, // Filter by the user who reported it
      vicId: userVicId, // Also ensure it's from their VIC
      active: true,
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: { workOrders: true },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  return incidents;
}

/**
 * Update existing incident
 * Verifies user has access to the incident's VIC before updating
 */
export async function updateIncident(id: number, data: IncidentFormData) {
  const user = await requirePermission("incidents:update");

  // Verify access before update
  const existing = await prisma.incident.findUnique({
    where: { id },
    select: { vicId: true },
  });

  if (!existing) {
    throw new Error("Incident not found");
  }

  assertVicAccess(user, existing.vicId);

  const incident = await prisma.incident.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      sla: data.sla,
      typeId: data.typeId || null,
      statusId: data.statusId || null,
      vicId: data.vicId || null,
      scheduleId: data.scheduleId || null,
      resolvedAt: data.resolvedAt || null,
    },
    include: {
      type: true,
      status: true,
      vic: true,
      reportedBy: true,
    },
  });

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${id}`);
  return { success: true, data: incident };
}

/**
 * Delete incident (soft delete)
 * Verifies user has access to the incident's VIC before deleting
 * Uses transaction to ensure atomicity when checking for active children
 */
export async function deleteIncident(id: number) {
  const user = await requirePermission("incidents:delete");

  // Verify access before delete
  const incident = await prisma.incident.findUnique({
    where: { id },
    select: { vicId: true },
  });

  if (!incident) {
    throw new Error("Incident not found");
  }

  assertVicAccess(user, incident.vicId);

  // Use transaction to prevent race conditions when checking for children
  await prisma.$transaction(async (tx) => {
    // Check for active work orders
    const activeWorkOrders = await tx.workOrder.count({
      where: { incidentId: id, active: true },
    });

    if (activeWorkOrders > 0) {
      throw new Error(
        `No se puede eliminar el incidente. Tiene ${activeWorkOrders} orden(es) de trabajo activa(s).`,
      );
    }

    await tx.incident.update({
      where: { id },
      data: { active: false },
    });
  });

  revalidatePath("/admin/incidents");
  redirect("/admin/incidents");
}

/**
 * Close incident
 * Verifies user has access to the incident's VIC before closing
 */
export async function closeIncident(id: number) {
  const user = await requirePermission("incidents:close");

  // Verify access before closing
  const incident = await prisma.incident.findUnique({
    where: { id },
    select: { vicId: true },
  });

  if (!incident) {
    throw new Error("Incident not found");
  }

  assertVicAccess(user, incident.vicId);

  // Get the CERRADO status
  const closedStatus = await prisma.incidentStatus.findFirst({
    where: { name: "CERRADO" },
  });

  if (!closedStatus) {
    throw new Error("CERRADO status not found");
  }

  await prisma.incident.update({
    where: { id },
    data: {
      statusId: closedStatus.id,
      resolvedAt: new Date(),
    },
  });

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${id}`);
  return { success: true };
}

/**
 * Change incident status
 * Verifies user has access to the incident's VIC before changing status
 */
export async function changeIncidentStatus(id: number, statusId: number) {
  const user = await requirePermission("incidents:update");

  // Verify access before status change
  const existing = await prisma.incident.findUnique({
    where: { id },
    select: { vicId: true },
  });

  if (!existing) {
    throw new Error("Incident not found");
  }

  assertVicAccess(user, existing.vicId);

  const incident = await prisma.incident.update({
    where: { id },
    data: {
      statusId,
      resolvedAt: statusId === (await getClosedStatusId()) ? new Date() : null,
    },
    include: {
      status: true,
    },
  });

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${id}`);
  revalidatePath("/fsr/incidents");
  return { success: true, data: incident };
}

/**
 * Assign incident to FSR
 * Verifies user has access to the incident's VIC before assigning
 * Uses transaction to ensure atomicity when creating work order and updating incident
 * Creates notification for the FSR
 */
export async function assignIncidentToFSR(
  incidentId: number,
  fsrUserId: string,
) {
  const user = await requirePermission("incidents:assign");

  // Verify access to incident
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { vicId: true, title: true },
  });

  if (!incident) {
    throw new Error("Incident not found");
  }

  assertVicAccess(user, incident.vicId);

  // Verify the user is an FSR
  const fsr = await prisma.user.findUnique({
    where: { id: fsrUserId },
    include: { role: true },
  });

  if (!fsr || fsr.role.name !== "FSR") {
    throw new Error("El usuario seleccionado no es un FSR");
  }

  // Use transaction to create work order, update incident, and create notification
  const workOrder = await prisma.$transaction(async (tx) => {
    // Create work order for the incident
    const wo = await tx.workOrder.create({
      data: {
        incidentId,
        assignedToId: fsrUserId,
        notes: "Orden de trabajo asignada automáticamente",
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

    // Update incident status to EN_PROGRESO
    const inProgressStatus = await tx.incidentStatus.findFirst({
      where: { name: "EN_PROGRESO" },
    });

    if (inProgressStatus) {
      await tx.incident.update({
        where: { id: incidentId },
        data: { statusId: inProgressStatus.id },
      });
    }

    // Create notification for the FSR
    await tx.notification.create({
      data: {
        userId: fsrUserId,
        title: "Nueva Orden de Trabajo Asignada",
        message: `Se le ha asignado una orden de trabajo para el incidente: ${incident.title}`,
        type: "work_order_assigned",
        entityType: "work_order",
        entityId: wo.id,
        actionUrl: `/fsr/work-orders/${wo.id}`,
        priority: 2, // Medium priority
        metadata: {
          incidentId,
          incidentTitle: incident.title,
          assignedBy: user.name,
          assignedById: user.id,
        },
      },
    });

    return wo;
  });

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${incidentId}`);
  revalidatePath("/fsr/incidents");
  revalidatePath("/fsr/work-orders");
  return { success: true, data: workOrder };
}

/**
 * Helper to get closed status ID
 */
async function getClosedStatusId() {
  const closedStatus = await prisma.incidentStatus.findFirst({
    where: { name: "CERRADO" },
  });
  return closedStatus?.id || null;
}

/**
 * Get FSR users for assignment
 * Filtered by user's VIC (except ADMINISTRADOR who sees all FSRs)
 */
export async function getFSRUsers() {
  const user = await requirePermission("incidents:assign");
  const vicFilter = getVicWhereClause(user);

  const fsrRole = await prisma.role.findUnique({
    where: { name: "FSR" },
  });

  if (!fsrRole) {
    return [];
  }

  const fsrUsers = await prisma.user.findMany({
    where: {
      roleId: fsrRole.id,
      active: true,
      ...vicFilter, // Only FSRs from same VIC
    },
    select: {
      id: true,
      name: true,
      email: true,
      vic: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return fsrUsers;
}

/**
 * Get form options for incidents
 * VICs and schedules filtered by user's VIC (except ADMINISTRADOR)
 */
export async function getIncidentFormOptions() {
  const user = await requirePermission("incidents:read");
  const vicFilter = getVicWhereClause(user);

  // Schedule.vicId is required (not nullable), so handle vicFilter specially
  // If user has no VIC (vicFilter tries to match null), return impossible value to get empty result
  const isNullFilter =
    vicFilter.vicId &&
    typeof vicFilter.vicId === "object" &&
    "equals" in vicFilter.vicId &&
    vicFilter.vicId.equals === null;
  const scheduleWhere: { active: boolean; vicId?: string } = isNullFilter
    ? { active: true, vicId: "__IMPOSSIBLE_VALUE__" }
    : {
        active: true,
        ...(vicFilter.vicId && typeof vicFilter.vicId === "string"
          ? { vicId: vicFilter.vicId }
          : {}),
      };

  const [types, statuses, vics, users, schedules] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.incidentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    // Filter VICs by user's access
    prisma.vehicleInspectionCenter.findMany({
      where: {
        active: true,
        ...vicFilter,
      },
      orderBy: { name: "asc" },
    }),
    // Users not filtered by VIC (may need to see reporters from other VICs)
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    }),
    // Filter schedules by VIC (Schedule.vicId is required, so handle null case specially)
    prisma.schedule.findMany({
      where: scheduleWhere,
      orderBy: { scheduledAt: "desc" },
      take: 50,
    }),
  ]);

  return { types, statuses, vics, users, schedules };
}
