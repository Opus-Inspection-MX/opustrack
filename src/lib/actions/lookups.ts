"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { FALLBACK_INCIDENT_TYPE_NAME } from "@/lib/constants/incident-type";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  AssignmentStatusCreateSchema,
  AssignmentStatusUpdateSchema,
  EquipmentStatusCreateSchema,
  EquipmentStatusUpdateSchema,
  IncidentStatusCreateSchema,
  IncidentStatusUpdateSchema,
  StateCreateSchema,
  StateUpdateSchema,
  UserStatusCreateSchema,
  UserStatusUpdateSchema,
  VehicleStatusCreateSchema,
  VehicleStatusUpdateSchema,
  VehicleTripStatusCreateSchema,
  VehicleTripStatusUpdateSchema,
} from "@/lib/validations/catalogs";
import { incidentTypeSchema } from "@/lib/validations/incident-types";
import { createCatalogActions } from "./catalog-factory";
import { rejected } from "./result";

/**
 * Lookup catalogs, one config each.
 *
 * Eight catalogs used to repeat the same five operations (~1026 lines with
 * only the model, permission prefix, paths, and child relation differing).
 * The shared implementation lives in `createCatalogActions`; below is one
 * config per catalog plus thin `export async function` wrappers, which are
 * what the `"use server"` transform registers as actions.
 *
 * Each config owns its queries as closures, so Prisma's return types flow
 * through untouched — pages keep the exact row shapes they had before.
 *
 * Only `deletePermission` keeps a hand-written body: permissions have no
 * list/create/update surface (the permissions UI was removed), so there is
 * no catalog shape to configure.
 */

const insensitive = (value: string) =>
  ({ contains: value, mode: "insensitive" }) as const;

const withActive = (parsed: Record<string, unknown>) =>
  parsed.active !== undefined ? { active: parsed.active as boolean } : {};

// ==================== STATES ====================

export type StateFormData = {
  name: string;
  code: string;
  active?: boolean;
};

const states = createCatalogActions({
  permissions: {
    read: "states:read",
    create: "states:create",
    update: "states:update",
    del: "states:delete",
  },
  basePath: "/admin/states",
  schema: StateCreateSchema,
  updateSchema: StateUpdateSchema,
  runList: async (search, skip, take) => {
    const where: Prisma.StateWhereInput = search
      ? {
          active: true,
          OR: [{ name: insensitive(search) }, { code: insensitive(search) }],
        }
      : { active: true };
    const [rows, total] = await Promise.all([
      prisma.state.findMany({
        where,
        include: { _count: { select: { clients: true } } },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.state.count({ where }),
    ]);
    return { rows, total };
  },
  runGetById: (id) =>
    prisma.state.findUnique({
      where: { id },
      include: { clients: { where: { active: true } } },
    }),
  toCreateData: (v) => ({
    name: v.name as string,
    code: v.code as string,
    ...withActive(v),
  }),
  toUpdateData: (v) => ({
    name: v.name as string,
    code: v.code as string,
    ...withActive(v),
  }),
  runCreate: (data) =>
    prisma.state.create({ data: data as Prisma.StateCreateInput }),
  runUpdate: (id, data) =>
    prisma.state.update({
      where: { id },
      data: data as Prisma.StateUpdateInput,
    }),
  runDeactivate: (id) =>
    prisma.state.update({ where: { id }, data: { active: false } }),
  countChildren: (id) =>
    prisma.client.count({ where: { stateId: id, active: true } }),
  blockedMessage: (n) =>
    `No se puede eliminar: ${n} Cliente(s) pertenecen a este estado.`,
});

/**
 * Lightweight State list for select/dropdown inputs and filters.
 * Returns only { id, code, name } for all active States — no counts, no
 * pagination. Use this instead of getStatesAdmin() when you just need options.
 */
export async function getStatesForSelect() {
  await requirePermission("states:read");

  return prisma.state.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getStatesAdmin(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return states.list(params);
}

export async function getStateById(id: number) {
  return states.getById(id);
}

export async function createState(data: StateFormData) {
  return states.create(data);
}

export async function updateState(id: number, data: StateFormData) {
  return states.update(id, data);
}

export async function deleteState(id: number) {
  return states.remove(id);
}

// ==================== USER STATUS ====================

export type UserStatusFormData = {
  name: string;
  active?: boolean;
};

const userStatuses = createCatalogActions({
  permissions: {
    read: "user-status:read",
    create: "user-status:create",
    update: "user-status:update",
    del: "user-status:delete",
  },
  basePath: "/admin/user-status",
  schema: UserStatusCreateSchema,
  updateSchema: UserStatusUpdateSchema,
  runList: async (search, skip, take) => {
    const where: Prisma.UserStatusWhereInput = search
      ? { active: true, name: insensitive(search) }
      : { active: true };
    const [rows, total] = await Promise.all([
      prisma.userStatus.findMany({
        where,
        include: { _count: { select: { users: true } } },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.userStatus.count({ where }),
    ]);
    return { rows, total };
  },
  runGetById: (id) =>
    prisma.userStatus.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    }),
  toCreateData: (v) => ({ name: v.name as string, ...withActive(v) }),
  toUpdateData: (v) => ({ name: v.name as string, ...withActive(v) }),
  runCreate: (data) =>
    prisma.userStatus.create({ data: data as Prisma.UserStatusCreateInput }),
  runUpdate: (id, data) =>
    prisma.userStatus.update({
      where: { id },
      data: data as Prisma.UserStatusUpdateInput,
    }),
  runDeactivate: (id) =>
    prisma.userStatus.update({ where: { id }, data: { active: false } }),
  countChildren: (id) =>
    prisma.user.count({ where: { userStatusId: id, active: true } }),
  blockedMessage: (n) =>
    `No se puede eliminar: ${n} usuario(s) tienen este estado.`,
});

export async function getUserStatuses(options?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return userStatuses.list(options);
}

export async function getUserStatusById(id: number) {
  return userStatuses.getById(id);
}

export async function createUserStatus(data: UserStatusFormData) {
  return userStatuses.create(data);
}

export async function updateUserStatus(id: number, data: UserStatusFormData) {
  return userStatuses.update(id, data);
}

export async function deleteUserStatus(id: number) {
  return userStatuses.remove(id);
}

// ==================== INCIDENT TYPES ====================

export type IncidentTypeFormData = {
  name: string;
  description?: string;
  active?: boolean;
  priority: number;
};

const incidentTypes = createCatalogActions({
  permissions: {
    read: "incident-types:read",
    create: "incident-types:create",
    update: "incident-types:update",
    del: "incident-types:delete",
  },
  basePath: "/admin/incident-types",
  schema: incidentTypeSchema,
  runList: async (search, skip, take) => {
    const where: Prisma.IncidentTypeWhereInput = search
      ? {
          active: true,
          OR: [
            { name: insensitive(search) },
            { description: insensitive(search) },
          ],
        }
      : { active: true };
    const [rows, total] = await Promise.all([
      prisma.incidentType.findMany({
        where,
        include: { _count: { select: { incidents: true } } },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.incidentType.count({ where }),
    ]);
    return { rows, total };
  },
  mapRow: (row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    active: row.active,
    priority: row.priority,
    incidentCount: row._count.incidents,
    createdAt: new Date().toISOString(), // IncidentType doesn't have createdAt
    updatedAt: new Date().toISOString(), // IncidentType doesn't have updatedAt
  }),
  runGetById: (id) =>
    prisma.incidentType.findUnique({
      where: { id },
      include: { _count: { select: { incidents: true } } },
    }),
  toCreateData: (v) => ({
    name: v.name as string,
    description: (v.description as string | undefined) || null,
    priority: v.priority as number,
    ...withActive(v),
  }),
  toUpdateData: (v) => ({
    name: v.name as string,
    description: (v.description as string | undefined) || null,
    priority: v.priority as number,
    ...withActive(v),
  }),
  runCreate: (data) =>
    prisma.incidentType.create({
      data: data as Prisma.IncidentTypeCreateInput,
    }),
  runUpdate: (id, data) =>
    prisma.incidentType.update({
      where: { id },
      data: data as Prisma.IncidentTypeUpdateInput,
    }),
  runDeactivate: (id) =>
    prisma.incidentType.update({ where: { id }, data: { active: false } }),
  preDelete: async (id) => {
    const existing = await prisma.incidentType.findUnique({
      where: { id },
      select: { name: true },
    });
    return existing?.name === FALLBACK_INCIDENT_TYPE_NAME
      ? `El tipo "${FALLBACK_INCIDENT_TYPE_NAME}" es del sistema y no se puede eliminar.`
      : null;
  },
  countChildren: (id) =>
    prisma.incident.count({ where: { typeId: id, active: true } }),
  blockedMessage: (n) =>
    `No se puede eliminar: ${n} incidente(s) tienen este tipo.`,
});

export async function getIncidentTypes(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return incidentTypes.list(params);
}

export async function getIncidentTypeById(id: number) {
  return incidentTypes.getById(id);
}

export async function createIncidentType(data: IncidentTypeFormData) {
  return incidentTypes.create(data);
}

export async function updateIncidentType(
  id: number,
  data: IncidentTypeFormData,
) {
  return incidentTypes.update(id, data);
}

export async function deleteIncidentType(id: number) {
  return incidentTypes.remove(id);
}

// ==================== INCIDENT STATUS ====================

export type IncidentStatusFormData = {
  name: string;
  color?: string;
  active?: boolean;
};

const incidentStatuses = createCatalogActions({
  permissions: {
    read: "incident-status:read",
    create: "incident-status:create",
    update: "incident-status:update",
    del: "incident-status:delete",
  },
  basePath: "/admin/incident-status",
  schema: IncidentStatusCreateSchema,
  updateSchema: IncidentStatusUpdateSchema,
  runList: async (search, skip, take) => {
    const where: Prisma.IncidentStatusWhereInput = search
      ? { active: true, name: insensitive(search) }
      : { active: true };
    const [rows, total] = await Promise.all([
      prisma.incidentStatus.findMany({
        where,
        include: { _count: { select: { incidents: true } } },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.incidentStatus.count({ where }),
    ]);
    return { rows, total };
  },
  mapRow: (row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    active: row.active,
    incidentCount: row._count.incidents,
    createdAt: new Date().toISOString(), // IncidentStatus doesn't have createdAt
    updatedAt: new Date().toISOString(), // IncidentStatus doesn't have updatedAt
  }),
  runGetById: (id) =>
    prisma.incidentStatus.findUnique({
      where: { id },
      include: { _count: { select: { incidents: true } } },
    }),
  toCreateData: (v) => ({
    name: v.name as string,
    color: (v.color as string | undefined) || "#6B7280",
    ...withActive(v),
  }),
  toUpdateData: (v) => ({
    name: v.name as string,
    ...(v.color ? { color: v.color as string } : {}),
    ...withActive(v),
  }),
  runCreate: (data) =>
    prisma.incidentStatus.create({
      data: data as Prisma.IncidentStatusCreateInput,
    }),
  runUpdate: (id, data) =>
    prisma.incidentStatus.update({
      where: { id },
      data: data as Prisma.IncidentStatusUpdateInput,
    }),
  runDeactivate: (id) =>
    prisma.incidentStatus.update({ where: { id }, data: { active: false } }),
  countChildren: (id) =>
    prisma.incident.count({ where: { statusId: id, active: true } }),
  blockedMessage: (n) =>
    `No se puede eliminar: ${n} incidente(s) tienen este estado.`,
});

export async function getIncidentStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return incidentStatuses.list(params);
}

export async function getIncidentStatusById(id: number) {
  return incidentStatuses.getById(id);
}

export async function createIncidentStatus(data: IncidentStatusFormData) {
  return incidentStatuses.create(data);
}

export async function updateIncidentStatus(
  id: number,
  data: IncidentStatusFormData,
) {
  return incidentStatuses.update(id, data);
}

export async function deleteIncidentStatus(id: number) {
  return incidentStatuses.remove(id);
}

// ==================== ASSIGNMENT STATUS ====================

export type AssignmentStatusFormData = {
  name: string;
  color?: string;
  active?: boolean;
};

const assignmentStatuses = createCatalogActions({
  permissions: {
    read: "assignment-status:read",
    create: "assignment-status:create",
    update: "assignment-status:update",
    del: "assignment-status:delete",
  },
  basePath: "/admin/settings/assignment-status",
  schema: AssignmentStatusCreateSchema,
  updateSchema: AssignmentStatusUpdateSchema,
  runList: async (search, skip, take) => {
    const where: Prisma.AssignmentStatusWhereInput = search
      ? { active: true, name: insensitive(search) }
      : { active: true };
    const [rows, total] = await Promise.all([
      prisma.assignmentStatus.findMany({
        where,
        include: { _count: { select: { assignments: true } } },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.assignmentStatus.count({ where }),
    ]);
    return { rows, total };
  },
  mapRow: (row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    active: row.active,
    _count: { assignments: row._count.assignments },
  }),
  runGetById: (id) =>
    prisma.assignmentStatus.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    }),
  toCreateData: (v) => ({
    name: v.name as string,
    color: (v.color as string | undefined) || "#6B7280",
    ...withActive(v),
  }),
  toUpdateData: (v) => ({
    name: v.name as string,
    ...(v.color ? { color: v.color as string } : {}),
    ...withActive(v),
  }),
  runCreate: (data) =>
    prisma.assignmentStatus.create({
      data: data as Prisma.AssignmentStatusCreateInput,
    }),
  runUpdate: (id, data) =>
    prisma.assignmentStatus.update({
      where: { id },
      data: data as Prisma.AssignmentStatusUpdateInput,
    }),
  runDeactivate: (id) =>
    prisma.assignmentStatus.update({ where: { id }, data: { active: false } }),
  countChildren: (id) =>
    prisma.assignment.count({ where: { statusId: id, active: true } }),
  blockedMessage: (n) =>
    `No se puede eliminar: ${n} asignación(es) tienen este estado.`,
});

export async function getAssignmentStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return assignmentStatuses.list(params);
}

export async function getAssignmentStatusById(id: number) {
  return assignmentStatuses.getById(id);
}

export async function createAssignmentStatus(data: AssignmentStatusFormData) {
  return assignmentStatuses.create(data);
}

export async function updateAssignmentStatus(
  id: number,
  data: AssignmentStatusFormData,
) {
  return assignmentStatuses.update(id, data);
}

export async function deleteAssignmentStatus(id: number) {
  return assignmentStatuses.remove(id);
}

// ==================== EQUIPMENT STATUS ====================

export type EquipmentStatusFormData = {
  name: string;
  active?: boolean;
};

const equipmentStatuses = createCatalogActions({
  permissions: {
    read: "settings:read",
    create: "settings:create",
    update: "settings:update",
    del: "settings:delete",
  },
  basePath: "/admin/settings/equipment-status",
  schema: EquipmentStatusCreateSchema,
  updateSchema: EquipmentStatusUpdateSchema,
  runList: async (search, skip, take) => {
    const where: Prisma.EquipmentStatusWhereInput = search
      ? { active: true, name: insensitive(search) }
      : { active: true };
    const [rows, total] = await Promise.all([
      prisma.equipmentStatus.findMany({
        where,
        include: { _count: { select: { equipments: true } } },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.equipmentStatus.count({ where }),
    ]);
    return { rows, total };
  },
  runGetById: (id) =>
    prisma.equipmentStatus.findUnique({
      where: { id },
      include: { _count: { select: { equipments: true } } },
    }),
  toCreateData: (v) => ({ name: v.name as string, ...withActive(v) }),
  toUpdateData: (v) => ({ name: v.name as string, ...withActive(v) }),
  runCreate: (data) =>
    prisma.equipmentStatus.create({
      data: data as Prisma.EquipmentStatusCreateInput,
    }),
  runUpdate: (id, data) =>
    prisma.equipmentStatus.update({
      where: { id },
      data: data as Prisma.EquipmentStatusUpdateInput,
    }),
  runDeactivate: (id) =>
    prisma.equipmentStatus.update({ where: { id }, data: { active: false } }),
  countChildren: (id) =>
    prisma.equipment.count({ where: { statusId: id, active: true } }),
  blockedMessage: (n) =>
    `No se puede eliminar: ${n} equipo(s) tienen este estado.`,
});

export async function getEquipmentStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return equipmentStatuses.list(params);
}

export async function getEquipmentStatusById(id: number) {
  return equipmentStatuses.getById(id);
}

export async function createEquipmentStatus(data: EquipmentStatusFormData) {
  return equipmentStatuses.create(data);
}

export async function updateEquipmentStatus(
  id: number,
  data: EquipmentStatusFormData,
) {
  return equipmentStatuses.update(id, data);
}

export async function deleteEquipmentStatus(id: number) {
  return equipmentStatuses.remove(id);
}

// ==================== VEHICLE STATUS ====================

export type VehicleStatusFormData = {
  name: string;
  active?: boolean;
};

const vehicleStatuses = createCatalogActions({
  permissions: {
    read: "settings:read",
    create: "settings:create",
    update: "settings:update",
    del: "settings:delete",
  },
  basePath: "/admin/settings/vehicle-status",
  schema: VehicleStatusCreateSchema,
  updateSchema: VehicleStatusUpdateSchema,
  runList: async (search, skip, take) => {
    const where: Prisma.VehicleStatusWhereInput = search
      ? { active: true, name: insensitive(search) }
      : { active: true };
    const [rows, total] = await Promise.all([
      prisma.vehicleStatus.findMany({
        where,
        include: { _count: { select: { vehicles: true } } },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.vehicleStatus.count({ where }),
    ]);
    return { rows, total };
  },
  runGetById: (id) =>
    prisma.vehicleStatus.findUnique({
      where: { id },
      include: { _count: { select: { vehicles: true } } },
    }),
  toCreateData: (v) => ({ name: v.name as string, ...withActive(v) }),
  toUpdateData: (v) => ({ name: v.name as string, ...withActive(v) }),
  runCreate: (data) =>
    prisma.vehicleStatus.create({
      data: data as Prisma.VehicleStatusCreateInput,
    }),
  runUpdate: (id, data) =>
    prisma.vehicleStatus.update({
      where: { id },
      data: data as Prisma.VehicleStatusUpdateInput,
    }),
  runDeactivate: (id) =>
    prisma.vehicleStatus.update({ where: { id }, data: { active: false } }),
  countChildren: (id) =>
    prisma.vehicle.count({ where: { statusId: id, active: true } }),
  blockedMessage: (n) =>
    `No se puede eliminar: ${n} vehículo(s) tienen este estado.`,
});

export async function getVehicleStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return vehicleStatuses.list(params);
}

export async function getVehicleStatusById(id: number) {
  return vehicleStatuses.getById(id);
}

export async function createVehicleStatus(data: VehicleStatusFormData) {
  return vehicleStatuses.create(data);
}

export async function updateVehicleStatus(
  id: number,
  data: VehicleStatusFormData,
) {
  return vehicleStatuses.update(id, data);
}

export async function deleteVehicleStatus(id: number) {
  return vehicleStatuses.remove(id);
}

// ==================== VEHICLE TRIP STATUS ====================

export type VehicleTripStatusFormData = {
  name: string;
  active?: boolean;
};

const vehicleTripStatuses = createCatalogActions({
  permissions: {
    read: "settings:read",
    create: "settings:create",
    update: "settings:update",
    del: "settings:delete",
  },
  basePath: "/admin/settings/vehicle-trip-status",
  schema: VehicleTripStatusCreateSchema,
  updateSchema: VehicleTripStatusUpdateSchema,
  runList: async (search, skip, take) => {
    const where: Prisma.VehicleTripStatusWhereInput = search
      ? { active: true, name: insensitive(search) }
      : { active: true };
    const [rows, total] = await Promise.all([
      prisma.vehicleTripStatus.findMany({
        where,
        include: { _count: { select: { trips: true } } },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.vehicleTripStatus.count({ where }),
    ]);
    return { rows, total };
  },
  runGetById: (id) =>
    prisma.vehicleTripStatus.findUnique({
      where: { id },
      include: { _count: { select: { trips: true } } },
    }),
  toCreateData: (v) => ({ name: v.name as string, ...withActive(v) }),
  toUpdateData: (v) => ({ name: v.name as string, ...withActive(v) }),
  runCreate: (data) =>
    prisma.vehicleTripStatus.create({
      data: data as Prisma.VehicleTripStatusCreateInput,
    }),
  runUpdate: (id, data) =>
    prisma.vehicleTripStatus.update({
      where: { id },
      data: data as Prisma.VehicleTripStatusUpdateInput,
    }),
  runDeactivate: (id) =>
    prisma.vehicleTripStatus.update({
      where: { id },
      data: { active: false },
    }),
  countChildren: (id) =>
    prisma.vehicleTrip.count({ where: { statusId: id, active: true } }),
  blockedMessage: (n) =>
    `No se puede eliminar: ${n} viaje(s) tienen este estado.`,
});

export async function getVehicleTripStatuses(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return vehicleTripStatuses.list(params);
}

export async function getVehicleTripStatusById(id: number) {
  return vehicleTripStatuses.getById(id);
}

export async function createVehicleTripStatus(data: VehicleTripStatusFormData) {
  return vehicleTripStatuses.create(data);
}

export async function updateVehicleTripStatus(
  id: number,
  data: VehicleTripStatusFormData,
) {
  return vehicleTripStatuses.update(id, data);
}

export async function deleteVehicleTripStatus(id: number) {
  return vehicleTripStatuses.remove(id);
}

// ==================== PERMISSIONS ====================
// Only `deletePermission` survives here: the standalone permissions UI was a
// mock tree and was removed. Permission assignment lives under each role
// (`/admin/roles/[id]/permissions`); deletion stays as a guarded server
// action covered by the catalog-deletes tests.

export async function deletePermission(id: number) {
  await requirePermission("permissions:manage");

  const roleCount = await prisma.rolePermission.count({
    where: { permissionId: id, active: true },
  });

  if (roleCount > 0) {
    return rejected(
      `No se puede eliminar: ${roleCount} rol(es) tienen este permiso.`,
    );
  }

  await prisma.permission.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/roles");
  redirect("/admin/roles");
}
