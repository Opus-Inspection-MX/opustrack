import { z } from "zod";
import { parseMxDateTime } from "@/lib/utils/datetime";
import { baseQuerySchema, cuidSchema, intIdSchema } from "./common";

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
  typeId: intIdSchema.nullable().optional(),
  statusId: intIdSchema.nullable().optional(),
  clienteId: cuidSchema.nullable().optional(),
  scheduleId: cuidSchema.nullable().optional(),
  reportedById: cuidSchema.nullable().optional(),
  reporterName: z
    .string()
    .max(120, "El nombre de quien reporta no puede exceder 120 caracteres")
    .nullable()
    .optional(),
  startedAt: z.date().nullable().optional(),
  resolvedAt: z.date().nullable().optional(),
  assigneeIds: z.array(cuidSchema).optional(),
});

/**
 * Schema for creating an incident as a client.
 * typeId optional → server falls back to "Desconocido".
 */
export const IncidentClientCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z.string().min(1, "Description is required"),
  typeId: intIdSchema.optional(),
  lineId: intIdSchema.optional(),
  equipmentId: intIdSchema.optional(),
  // The center's account is shared, so this is the only way to know which
  // person actually raised it. Optional: pre-existing flows do not send it.
  reporterName: z
    .string()
    .max(120, "El nombre de quien reporta no puede exceder 120 caracteres")
    .nullable()
    .optional(),
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
  clienteId: z.string().cuid().optional(),
  sortBy: z.enum(["reportedAt", "title", "updatedAt"]).default("reportedAt"),
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
    const d = parseMxDateTime(trimmed);
    if (!d) {
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
  typeId: optionalIntFromCsv,
  statusId: optionalIntFromCsv,
  clienteId: optionalStringFromCsv,
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
 * cliente = Cliente.code, tipo = IncidentType.name. scheduleId comes from the page-level selector.
 */
export const BulkIncidentTemplateRowSchema = z.object({
  titulo: z
    .string()
    .min(3, "Título debe tener al menos 3 caracteres")
    .max(200, "Título debe tener máximo 200 caracteres"),
  descripcion: z.string().min(1, "Descripción es requerida"),
  tipo: optionalStringFromCsv,
  fecha_inicio: optionalDateFromCsv,
  cliente: optionalStringFromCsv,
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
