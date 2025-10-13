"use server";

import { prisma } from "@/lib/database/prisma.singleton";
import { requirePermission } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
};

/**
 * Get all incidents with relations
 */
export async function getIncidents() {
  await requirePermission("incidents:read");

  const incidents = await prisma.incident.findMany({
    where: { active: true },
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
 */
export async function getIncidentById(id: number) {
  await requirePermission("incidents:read");

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
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

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
  typeId?: number
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

  const incidents = await prisma.incident.findMany({
    where: {
      vicId: user.vicId,
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
 */
export async function updateIncident(id: number, data: IncidentFormData) {
  await requirePermission("incidents:update");

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
 */
export async function deleteIncident(id: number) {
  await requirePermission("incidents:delete");

  await prisma.incident.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/incidents");
  redirect("/admin/incidents");
}

/**
 * Close incident
 */
export async function closeIncident(id: number) {
  await requirePermission("incidents:close");

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
 * Change incident status (Admin only)
 */
export async function changeIncidentStatus(id: number, statusId: number) {
  await requirePermission("incidents:update");

  const incident = await prisma.incident.update({
    where: { id },
    data: {
      statusId,
      resolvedAt: statusId === await getClosedStatusId() ? new Date() : null,
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
 * Assign incident to FSR (Admin only)
 */
export async function assignIncidentToFSR(
  incidentId: number,
  fsrUserId: string
) {
  await requirePermission("incidents:assign");

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
      status: "PENDIENTE",
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
 */
export async function getFSRUsers() {
  await requirePermission("incidents:assign");

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
 */
export async function getIncidentFormOptions() {
  await requirePermission("incidents:read");

  const [types, statuses, vics, users, schedules] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.incidentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.vehicleInspectionCenter.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
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
    prisma.schedule.findMany({
      where: { active: true },
      orderBy: { scheduledAt: "desc" },
      take: 50,
    }),
  ]);

  return { types, statuses, vics, users, schedules };
}
