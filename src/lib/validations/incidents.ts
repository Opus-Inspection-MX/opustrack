import { z } from "zod";
import {
  baseQuerySchema,
  cuidSchema,
  intIdSchema,
  prioritySchema,
} from "./common";

/**
 * Schema for creating an incident. typeId is optional at the validation
 * layer because the server falls back to the "Desconocido" type when not
 * provided; the UI should still treat it as required.
 */
export const IncidentCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z.string().min(1, "Description is required"),
  priority: prioritySchema,
  typeId: intIdSchema.nullable().optional(),
  statusId: intIdSchema.nullable().optional(),
  vicId: cuidSchema.nullable().optional(),
  scheduleId: cuidSchema.nullable().optional(),
  reportedById: cuidSchema.nullable().optional(),
  startedAt: z.date().nullable().optional(),
  resolvedAt: z.date().nullable().optional(),
  assigneeIds: z.array(cuidSchema).optional(),
});

/**
 * Schema for creating an incident as a client. SLA is implicit (lives on the
 * IncidentType). typeId optional → server falls back to "Desconocido".
 */
export const IncidentClientCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z.string().min(1, "Description is required"),
  priority: prioritySchema,
  typeId: intIdSchema.optional(),
  lineId: intIdSchema.optional(),
  equipmentId: intIdSchema.optional(),
});

/**
 * Schema for updating an incident
 */
export const IncidentUpdateSchema = IncidentCreateSchema.partial().extend({
  id: intIdSchema,
});

/**
 * Schema for deleting an incident
 */
export const IncidentDeleteSchema = z.object({
  id: intIdSchema,
});

/**
 * Schema for changing incident status
 */
export const IncidentChangeStatusSchema = z.object({
  id: intIdSchema,
  statusId: intIdSchema,
});

/**
 * Schema for assigning incident to FSR
 */
export const IncidentAssignSchema = z.object({
  incidentId: intIdSchema,
  fsrUserId: cuidSchema,
});

/**
 * Schema for querying incidents
 */
export const IncidentQuerySchema = baseQuerySchema.extend({
  statusId: z.coerce.number().int().positive().optional(),
  typeId: z.coerce.number().int().positive().optional(),
  vicId: z.string().cuid().optional(),
  priority: z.coerce.number().int().min(1).max(10).optional(),
  sortBy: z
    .enum(["reportedAt", "priority", "title", "updatedAt"])
    .default("reportedAt"),
});

/**
 * Common CSV helpers: coerce strings, treat "" as omitted.
 */
const optionalIntFromCsv = z
  .union([z.literal(""), z.coerce.number().int()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

const optionalStringFromCsv = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const optionalDateFromCsv = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v || v.trim() === "") return undefined;
    const trimmed = v.trim();
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Fecha inválida: "${trimmed}". Usa formato YYYY-MM-DD o YYYY-MM-DD HH:mm.`,
      });
      return z.NEVER;
    }
    return d;
  });

/**
 * SNAPSHOT row schema — what `buildSnapshotCsv` produces and what the app
 * re-ingests. All FKs are IDs already resolved. Not user-friendly.
 */
export const BulkIncidentSnapshotRowSchema = z.object({
  title: z
    .string()
    .min(3, "Título debe tener al menos 3 caracteres")
    .max(200, "Título debe tener máximo 200 caracteres"),
  description: z.string().min(1, "Descripción es requerida"),
  priority: z.coerce
    .number()
    .int()
    .min(1, "Prioridad mínima 1")
    .max(10, "Prioridad máxima 10"),
  typeId: optionalIntFromCsv,
  statusId: optionalIntFromCsv,
  vicId: optionalStringFromCsv,
  scheduleId: optionalStringFromCsv,
  startedAt: optionalDateFromCsv,
  resolvedAt: optionalDateFromCsv,
  assigneeIds: optionalStringFromCsv,
});

export type BulkIncidentSnapshotRowInput = z.infer<
  typeof BulkIncidentSnapshotRowSchema
>;

/**
 * TEMPLATE row schema — human-readable plantilla the admin fills.
 * vic = VIC.code, tipo = IncidentType.name. scheduleId comes from the page-level selector.
 */
export const BulkIncidentTemplateRowSchema = z.object({
  titulo: z
    .string()
    .min(3, "Título debe tener al menos 3 caracteres")
    .max(200, "Título debe tener máximo 200 caracteres"),
  descripcion: z.string().min(1, "Descripción es requerida"),
  prioridad: z.coerce
    .number()
    .int()
    .min(1, "Prioridad mínima 1")
    .max(10, "Prioridad máxima 10"),
  tipo: optionalStringFromCsv,
  fecha_inicio: optionalDateFromCsv,
  vic: optionalStringFromCsv,
});

export type BulkIncidentTemplateRowInput = z.infer<
  typeof BulkIncidentTemplateRowSchema
>;

export function parseAssigneeIds(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Type inference
export type IncidentCreateInput = z.infer<typeof IncidentCreateSchema>;
export type IncidentClientCreateInput = z.infer<
  typeof IncidentClientCreateSchema
>;
export type IncidentUpdateInput = z.infer<typeof IncidentUpdateSchema>;
export type IncidentDeleteInput = z.infer<typeof IncidentDeleteSchema>;
export type IncidentChangeStatusInput = z.infer<
  typeof IncidentChangeStatusSchema
>;
export type IncidentAssignInput = z.infer<typeof IncidentAssignSchema>;
export type IncidentQueryInput = z.infer<typeof IncidentQuerySchema>;
