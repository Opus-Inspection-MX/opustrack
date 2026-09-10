import { z } from "zod";

/**
 * Server-side input schemas for the lookup catalogs.
 *
 * The admin forms validate client-side with their own inline schemas; these
 * are the server boundary — `createCatalogActions` parses every create/update
 * payload through them, so unparsed input never reaches Prisma. Shapes mirror
 * what the forms send (`active` always present from the UI, optional at the
 * boundary for callers that omit it).
 */

const catalogBase = z.object({
  name: z.string().min(1, "Name is required").max(100),
  active: z.boolean().optional(),
});

const colorStatusBase = catalogBase.extend({
  color: z.string().optional(),
});

export const StateCreateSchema = catalogBase.extend({
  code: z.string().min(1, "Code is required").max(10),
});
export const StateUpdateSchema = StateCreateSchema;

export const UserStatusCreateSchema = catalogBase;
export const UserStatusUpdateSchema = UserStatusCreateSchema;

export const IncidentStatusCreateSchema = colorStatusBase;
export const IncidentStatusUpdateSchema = IncidentStatusCreateSchema;

export const AssignmentStatusCreateSchema = colorStatusBase;
export const AssignmentStatusUpdateSchema = AssignmentStatusCreateSchema;

export const EquipmentStatusCreateSchema = catalogBase;
export const EquipmentStatusUpdateSchema = EquipmentStatusCreateSchema;

export const VehicleStatusCreateSchema = catalogBase;
export const VehicleStatusUpdateSchema = VehicleStatusCreateSchema;

export const VehicleTripStatusCreateSchema = catalogBase;
export const VehicleTripStatusUpdateSchema = VehicleTripStatusCreateSchema;
