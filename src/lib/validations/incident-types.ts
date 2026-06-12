import { z } from "zod";
import {
  MAX_INCIDENT_PRIORITY,
  MIN_INCIDENT_PRIORITY,
} from "@/lib/constants/incident-type";

/**
 * Schema for creating or updating an IncidentType via the admin form.
 * `priority` is validated as a number; the form coerces the HTML input via
 * react-hook-form's `valueAsNumber`, so the schema receives a number directly.
 */
export const incidentTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  active: z.boolean(),
  priority: z
    .number()
    .int("Priority must be a whole number")
    .min(
      MIN_INCIDENT_PRIORITY,
      `Priority must be at least ${MIN_INCIDENT_PRIORITY}`,
    )
    .max(
      MAX_INCIDENT_PRIORITY,
      `Priority must be at most ${MAX_INCIDENT_PRIORITY}`,
    ),
});

export type IncidentTypeFormData = z.infer<typeof incidentTypeSchema>;
