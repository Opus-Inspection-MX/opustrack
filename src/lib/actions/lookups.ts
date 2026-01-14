"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

// ==================== STATES ====================

export type StateFormData = {
  name: string;
  code: string;
  active?: boolean;
};

export async function getStatesAdmin() {
  await requirePermission("states:read");

  const states = await prisma.state.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { vehicleInspectionCenters: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return states;
}

export async function getStateById(id: number) {
  await requirePermission("states:read");

  const state = await prisma.state.findUnique({
    where: { id },
    include: {
      vehicleInspectionCenters: {
        where: { active: true },
      },
    },
  });

  return state;
}

export async function createState(data: StateFormData) {
  await requirePermission("states:create");

  const state = await prisma.state.create({
    data: {
      name: data.name,
      code: data.code,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/states");
  return { success: true, data: state };
}

export async function updateState(id: number, data: StateFormData) {
  await requirePermission("states:update");

  const state = await prisma.state.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/states");
  revalidatePath(`/admin/states/${id}`);
  return { success: true, data: state };
}

export async function deleteState(id: number) {
  await requirePermission("states:delete");

  const vicCount = await prisma.vehicleInspectionCenter.count({
    where: { stateId: id, active: true },
  });

  if (vicCount > 0) {
    throw new Error(
      `Cannot delete state. ${vicCount} VIC(s) are in this state.`,
    );
  }

  await prisma.state.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/states");
  redirect("/admin/states");
}

// ==================== USER STATUS ====================

export type UserStatusFormData = {
  name: string;
  active?: boolean;
};

export async function getUserStatuses() {
  await requirePermission("user-status:read");

  const statuses = await prisma.userStatus.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { users: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return statuses;
}

export async function getUserStatusById(id: number) {
  await requirePermission("user-status:read");

  const status = await prisma.userStatus.findUnique({
    where: { id },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });

  return status;
}

export async function createUserStatus(data: UserStatusFormData) {
  await requirePermission("user-status:create");

  const status = await prisma.userStatus.create({
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/user-status");
  return { success: true, data: status };
}

export async function updateUserStatus(id: number, data: UserStatusFormData) {
  await requirePermission("user-status:update");

  const status = await prisma.userStatus.update({
    where: { id },
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/user-status");
  revalidatePath(`/admin/user-status/${id}`);
  return { success: true, data: status };
}

export async function deleteUserStatus(id: number) {
  await requirePermission("user-status:delete");

  const userCount = await prisma.user.count({
    where: { userStatusId: id, active: true },
  });

  if (userCount > 0) {
    throw new Error(
      `Cannot delete status. ${userCount} user(s) have this status.`,
    );
  }

  await prisma.userStatus.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/user-status");
  redirect("/admin/user-status");
}

// ==================== INCIDENT TYPES ====================

export type IncidentTypeFormData = {
  name: string;
  description?: string;
  active?: boolean;
};

export async function getIncidentTypes(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  await requirePermission("incident-types:read");

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    active: true,
  };

  // Search by name or description
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  // Get total count
  const total = await prisma.incidentType.count({ where });

  // Get paginated types
  const types = await prisma.incidentType.findMany({
    where,
    include: {
      _count: {
        select: { incidents: true },
      },
    },
    orderBy: { name: "asc" },
    skip,
    take: limit,
  });

  // Serialize dates and transform data for client components
  const transformedTypes = types.map((type) => ({
    id: type.id,
    name: type.name,
    description: type.description ?? undefined,
    active: type.active,
    incidentCount: type._count.incidents,
    createdAt: new Date().toISOString(), // IncidentType doesn't have createdAt
    updatedAt: new Date().toISOString(), // IncidentType doesn't have updatedAt
  }));

  return {
    data: transformedTypes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getIncidentTypeById(id: number) {
  await requirePermission("incident-types:read");

  const type = await prisma.incidentType.findUnique({
    where: { id },
    include: {
      _count: {
        select: { incidents: true },
      },
    },
  });

  return type;
}

export async function createIncidentType(data: IncidentTypeFormData) {
  await requirePermission("incident-types:create");

  const type = await prisma.incidentType.create({
    data: {
      name: data.name,
      description: data.description || null,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/incident-types");
  return { success: true, data: type };
}

export async function updateIncidentType(
  id: number,
  data: IncidentTypeFormData,
) {
  await requirePermission("incident-types:update");

  const type = await prisma.incidentType.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/incident-types");
  revalidatePath(`/admin/incident-types/${id}`);
  return { success: true, data: type };
}

export async function deleteIncidentType(id: number) {
  await requirePermission("incident-types:delete");

  const incidentCount = await prisma.incident.count({
    where: { typeId: id, active: true },
  });

  if (incidentCount > 0) {
    throw new Error(
      `Cannot delete type. ${incidentCount} incident(s) have this type.`,
    );
  }

  await prisma.incidentType.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/incident-types");
  redirect("/admin/incident-types");
}

// ==================== INCIDENT STATUS ====================

export type IncidentStatusFormData = {
  name: string;
  color?: string;
  active?: boolean;
};

export async function getIncidentStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  await requirePermission("incident-status:read");

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    active: true,
  };

  // Search by name
  if (params?.search) {
    where.name = { contains: params.search, mode: "insensitive" };
  }

  // Get total count
  const total = await prisma.incidentStatus.count({ where });

  // Get paginated statuses
  const statuses = await prisma.incidentStatus.findMany({
    where,
    include: {
      _count: {
        select: { incidents: true },
      },
    },
    orderBy: { name: "asc" },
    skip,
    take: limit,
  });

  // Serialize dates and transform data for client components
  const transformedStatuses = statuses.map((status) => ({
    id: status.id,
    name: status.name,
    color: status.color,
    active: status.active,
    incidentCount: status._count.incidents,
    createdAt: new Date().toISOString(), // IncidentStatus doesn't have createdAt
    updatedAt: new Date().toISOString(), // IncidentStatus doesn't have updatedAt
  }));

  return {
    data: transformedStatuses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getIncidentStatusById(id: number) {
  await requirePermission("incident-status:read");

  const status = await prisma.incidentStatus.findUnique({
    where: { id },
    include: {
      _count: {
        select: { incidents: true },
      },
    },
  });

  return status;
}

export async function createIncidentStatus(data: IncidentStatusFormData) {
  await requirePermission("incident-status:create");

  const status = await prisma.incidentStatus.create({
    data: {
      name: data.name,
      color: data.color || "#6B7280",
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/incident-status");
  return { success: true, data: status };
}

export async function updateIncidentStatus(
  id: number,
  data: IncidentStatusFormData,
) {
  await requirePermission("incident-status:update");

  const status = await prisma.incidentStatus.update({
    where: { id },
    data: {
      name: data.name,
      ...(data.color && { color: data.color }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin/incident-status");
  revalidatePath(`/admin/incident-status/${id}`);
  return { success: true, data: status };
}

export async function deleteIncidentStatus(id: number) {
  await requirePermission("incident-status:delete");

  const incidentCount = await prisma.incident.count({
    where: { statusId: id, active: true },
  });

  if (incidentCount > 0) {
    throw new Error(
      `Cannot delete status. ${incidentCount} incident(s) have this status.`,
    );
  }

  await prisma.incidentStatus.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/incident-status");
  redirect("/admin/incident-status");
}

// ==================== LINE STATUS ====================

export type LineStatusFormData = {
  name: string;
  active?: boolean;
};

export async function getLineStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  await requirePermission("settings:read");

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { active: true };
  if (params?.search) {
    where.name = { contains: params.search, mode: "insensitive" };
  }

  const [data, total] = await Promise.all([
    prisma.lineStatus.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      include: {
        _count: { select: { lines: true } },
      },
    }),
    prisma.lineStatus.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getLineStatusById(id: number) {
  await requirePermission("settings:read");
  return await prisma.lineStatus.findUnique({
    where: { id },
    include: { _count: { select: { lines: true } } },
  });
}

export async function createLineStatus(data: LineStatusFormData) {
  await requirePermission("settings:create");
  const status = await prisma.lineStatus.create({
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  revalidatePath("/admin/settings/line-status");
  return { success: true, data: status };
}

export async function updateLineStatus(id: number, data: LineStatusFormData) {
  await requirePermission("settings:update");
  const status = await prisma.lineStatus.update({
    where: { id },
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  revalidatePath("/admin/settings/line-status");
  revalidatePath(`/admin/settings/line-status/${id}`);
  return { success: true, data: status };
}

export async function deleteLineStatus(id: number) {
  await requirePermission("settings:delete");
  const lineCount = await prisma.line.count({
    where: { statusId: id, active: true },
  });
  if (lineCount > 0) {
    throw new Error(`Cannot delete status. ${lineCount} line(s) have this status.`);
  }
  await prisma.lineStatus.update({
    where: { id },
    data: { active: false },
  });
  revalidatePath("/admin/settings/line-status");
  redirect("/admin/settings/line-status");
}

// ==================== EQUIPMENT STATUS ====================

export type EquipmentStatusFormData = {
  name: string;
  active?: boolean;
};

export async function getEquipmentStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  await requirePermission("settings:read");

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { active: true };
  if (params?.search) {
    where.name = { contains: params.search, mode: "insensitive" };
  }

  const [data, total] = await Promise.all([
    prisma.equipmentStatus.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      include: {
        _count: { select: { equipments: true } },
      },
    }),
    prisma.equipmentStatus.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEquipmentStatusById(id: number) {
  await requirePermission("settings:read");
  return await prisma.equipmentStatus.findUnique({
    where: { id },
    include: { _count: { select: { equipments: true } } },
  });
}

export async function createEquipmentStatus(data: EquipmentStatusFormData) {
  await requirePermission("settings:create");
  const status = await prisma.equipmentStatus.create({
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  revalidatePath("/admin/settings/equipment-status");
  return { success: true, data: status };
}

export async function updateEquipmentStatus(id: number, data: EquipmentStatusFormData) {
  await requirePermission("settings:update");
  const status = await prisma.equipmentStatus.update({
    where: { id },
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  revalidatePath("/admin/settings/equipment-status");
  revalidatePath(`/admin/settings/equipment-status/${id}`);
  return { success: true, data: status };
}

export async function deleteEquipmentStatus(id: number) {
  await requirePermission("settings:delete");
  const equipmentCount = await prisma.equipment.count({
    where: { statusId: id, active: true },
  });
  if (equipmentCount > 0) {
    throw new Error(`Cannot delete status. ${equipmentCount} equipment(s) have this status.`);
  }
  await prisma.equipmentStatus.update({
    where: { id },
    data: { active: false },
  });
  revalidatePath("/admin/settings/equipment-status");
  redirect("/admin/settings/equipment-status");
}

// ==================== VEHICLE STATUS ====================

export type VehicleStatusFormData = {
  name: string;
  active?: boolean;
};

export async function getVehicleStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  await requirePermission("settings:read");

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { active: true };
  if (params?.search) {
    where.name = { contains: params.search, mode: "insensitive" };
  }

  const [data, total] = await Promise.all([
    prisma.vehicleStatus.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      include: {
        _count: { select: { vehicles: true } },
      },
    }),
    prisma.vehicleStatus.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getVehicleStatusById(id: number) {
  await requirePermission("settings:read");
  return await prisma.vehicleStatus.findUnique({
    where: { id },
    include: { _count: { select: { vehicles: true } } },
  });
}

export async function createVehicleStatus(data: VehicleStatusFormData) {
  await requirePermission("settings:create");
  const status = await prisma.vehicleStatus.create({
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  revalidatePath("/admin/settings/vehicle-status");
  return { success: true, data: status };
}

export async function updateVehicleStatus(id: number, data: VehicleStatusFormData) {
  await requirePermission("settings:update");
  const status = await prisma.vehicleStatus.update({
    where: { id },
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  revalidatePath("/admin/settings/vehicle-status");
  revalidatePath(`/admin/settings/vehicle-status/${id}`);
  return { success: true, data: status };
}

export async function deleteVehicleStatus(id: number) {
  await requirePermission("settings:delete");
  const vehicleCount = await prisma.vehicle.count({
    where: { statusId: id, active: true },
  });
  if (vehicleCount > 0) {
    throw new Error(`Cannot delete status. ${vehicleCount} vehicle(s) have this status.`);
  }
  await prisma.vehicleStatus.update({
    where: { id },
    data: { active: false },
  });
  revalidatePath("/admin/settings/vehicle-status");
  redirect("/admin/settings/vehicle-status");
}

// ==================== VEHICLE TRIP STATUS ====================

export type VehicleTripStatusFormData = {
  name: string;
  active?: boolean;
};

export async function getVehicleTripStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  await requirePermission("settings:read");

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { active: true };
  if (params?.search) {
    where.name = { contains: params.search, mode: "insensitive" };
  }

  const [data, total] = await Promise.all([
    prisma.vehicleTripStatus.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      include: {
        _count: { select: { trips: true } },
      },
    }),
    prisma.vehicleTripStatus.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getVehicleTripStatusById(id: number) {
  await requirePermission("settings:read");
  return await prisma.vehicleTripStatus.findUnique({
    where: { id },
    include: { _count: { select: { trips: true } } },
  });
}

export async function createVehicleTripStatus(data: VehicleTripStatusFormData) {
  await requirePermission("settings:create");
  const status = await prisma.vehicleTripStatus.create({
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  revalidatePath("/admin/settings/vehicle-trip-status");
  return { success: true, data: status };
}

export async function updateVehicleTripStatus(id: number, data: VehicleTripStatusFormData) {
  await requirePermission("settings:update");
  const status = await prisma.vehicleTripStatus.update({
    where: { id },
    data: {
      name: data.name,
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  revalidatePath("/admin/settings/vehicle-trip-status");
  revalidatePath(`/admin/settings/vehicle-trip-status/${id}`);
  return { success: true, data: status };
}

export async function deleteVehicleTripStatus(id: number) {
  await requirePermission("settings:delete");
  const tripCount = await prisma.vehicleTrip.count({
    where: { statusId: id, active: true },
  });
  if (tripCount > 0) {
    throw new Error(`Cannot delete status. ${tripCount} trip(s) have this status.`);
  }
  await prisma.vehicleTripStatus.update({
    where: { id },
    data: { active: false },
  });
  revalidatePath("/admin/settings/vehicle-trip-status");
  redirect("/admin/settings/vehicle-trip-status");
}

// ==================== PERMISSIONS ====================

export type PermissionFormData = {
  name: string;
  description?: string;
  resource?: string;
  action?: string;
  routePath?: string;
};

export async function getPermissions() {
  await requirePermission("permissions:read");

  const permissions = await prisma.permission.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { roles: true },
      },
    },
    orderBy: [{ resource: "asc" }, { action: "asc" }],
  });

  return permissions;
}

export async function getPermissionById(id: number) {
  await requirePermission("permissions:read");

  const permission = await prisma.permission.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  return permission;
}

export async function createPermission(data: PermissionFormData) {
  await requirePermission("permissions:manage");

  const permission = await prisma.permission.create({
    data: {
      name: data.name,
      description: data.description || null,
      resource: data.resource || null,
      action: data.action || null,
      routePath: data.routePath || null,
    },
  });

  revalidatePath("/admin/permissions");
  return { success: true, data: permission };
}

export async function updatePermission(id: number, data: PermissionFormData) {
  await requirePermission("permissions:manage");

  const permission = await prisma.permission.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      resource: data.resource || null,
      action: data.action || null,
      routePath: data.routePath || null,
    },
  });

  revalidatePath("/admin/permissions");
  revalidatePath(`/admin/permissions/${id}`);
  return { success: true, data: permission };
}

export async function deletePermission(id: number) {
  await requirePermission("permissions:manage");

  const roleCount = await prisma.rolePermission.count({
    where: { permissionId: id, active: true },
  });

  if (roleCount > 0) {
    throw new Error(
      `Cannot delete permission. ${roleCount} role(s) have this permission.`,
    );
  }

  await prisma.permission.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/permissions");
  redirect("/admin/permissions");
}
