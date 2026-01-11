"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { assertVicAccess, getVicWhereClause } from "@/lib/auth/filters";
import { prisma } from "@/lib/database/prisma.singleton";

export type IncidentFormData = {
  title: string;
  description: string;
  priority: number;
  sla: number;
  typeId?: number | null;
  statusId?: number | null;
  vicId?: string | null;
  scheduleId?: string | null;
  reportedById?: string | null;
  resolvedAt?: Date | null;
};

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
 */
export async function createIncident(data: IncidentFormData) {
  const user = await requirePermission("incidents:create");

  const incident = await prisma.incident.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      sla: data.sla,
      typeId: data.typeId || null,
      statusId: data.statusId || null,
      vicId: data.vicId || null,
      scheduleId: data.scheduleId || null,
      reportedById: data.reportedById || user.id, // Use current user if not specified
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
  revalidatePath("/client/incidents");
  return { success: true, data: incident };
}

/**
 * Create incident as client (simplified for client role)
 */
export async function createIncidentAsClient(
  title: string,
  description: string,
  priority: number,
  typeId?: number,
  lineId?: number,
  equipmentId?: number,
) {
  const user = await requirePermission("incidents:create");

  // Get ABIERTO status
  const openStatus = await prisma.incidentStatus.findFirst({
    where: { name: "ABIERTO" },
  });

  if (!openStatus) {
    throw new Error("Estado ABIERTO no encontrado");
  }

  // Client must have a VIC assigned
  if (!user.vicId) {
    throw new Error("El usuario no tiene un VIC asignado");
  }

  const incident = await prisma.incident.create({
    data: {
      title,
      description,
      priority,
      sla: 24, // Default SLA for client incidents
      typeId: typeId || null,
      statusId: openStatus.id,
      vicId: user.vicId,
      reportedById: user.id,
      lineId: lineId || null,
      equipmentId: equipmentId || null,
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

  if (!user.vicId) {
    return [];
  }

  // Client users should only see incidents they reported themselves
  const incidents = await prisma.incident.findMany({
    where: {
      reportedById: user.id, // Filter by the user who reported it
      vicId: user.vicId, // Also ensure it's from their VIC
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

  await prisma.incident.update({
    where: { id },
    data: { active: false },
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
 */
export async function assignIncidentToFSR(
  incidentId: number,
  fsrUserId: string,
) {
  const user = await requirePermission("incidents:assign");

  // Verify access to incident
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { vicId: true },
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

  // Create work order for the incident
  const workOrder = await prisma.workOrder.create({
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
  const inProgressStatus = await prisma.incidentStatus.findFirst({
    where: { name: "EN_PROGRESO" },
  });

  if (inProgressStatus) {
    await prisma.incident.update({
      where: { id: incidentId },
      data: { statusId: inProgressStatus.id },
    });
  }

  revalidatePath("/admin/incidents");
  revalidatePath(`/admin/incidents/${incidentId}`);
  revalidatePath("/fsr/incidents");
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
