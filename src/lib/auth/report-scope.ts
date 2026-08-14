/**
 * Multi-tenancy scoping for reports and the dashboard.
 *
 * Reports aggregate across several entities, each reaching the Cliente by a
 * different path. These helpers turn one resolved scope into the correct
 * Prisma `where` fragment per entity, so every report applies the same rule
 * (cross-cutting rule #4: non-ADMINISTRADOR users only see their Cliente data).
 *
 * Fail closed: a user with no Cliente assignment matches nothing rather than
 * everything.
 */

import type { Prisma } from "@prisma/client";
import type { UserWithPermissions } from "@/lib/authz/authz";
import { getUserClienteIds } from "@/lib/utils/cliente-assignments";
import { isAdmin } from "./filters";

export interface ReportScope {
  /** `null` means unrestricted (ADMINISTRADOR). */
  clienteIds: string[] | null;
}

/** Resolve the Cliente scope of the current user. */
export async function getReportScope(
  user: UserWithPermissions,
): Promise<ReportScope> {
  if (isAdmin(user)) return { clienteIds: null };

  const clienteIds = await getUserClienteIds(user.id);
  if (clienteIds.length > 0) return { clienteIds };

  // Fall back to the legacy single-Cliente column before failing closed.
  return { clienteIds: user.clienteId ? [user.clienteId] : [] };
}

/** Incident: owns `clienteId` directly. */
export function incidentScopeWhere(
  scope: ReportScope,
): Prisma.IncidentWhereInput {
  if (scope.clienteIds === null) return {};
  return { clienteId: { in: scope.clienteIds } };
}

/** Assignment: reaches the Cliente through its incident. */
export function assignmentScopeWhere(
  scope: ReportScope,
): Prisma.AssignmentWhereInput {
  if (scope.clienteIds === null) return {};
  return { incident: incidentScopeWhere(scope) };
}

/** User (FSR): scoped by their active Cliente assignments. */
export function fsrScopeWhere(scope: ReportScope): Prisma.UserWhereInput {
  if (scope.clienteIds === null) return {};
  return {
    clienteAssignments: {
      some: { active: true, clienteId: { in: scope.clienteIds } },
    },
  };
}

/**
 * VehicleTrip: linked trips scope through their assignment; unlinked trips
 * scope through the FSR who drove them, so mileage is not under-reported.
 */
export function vehicleTripScopeWhere(
  scope: ReportScope,
): Prisma.VehicleTripWhereInput {
  if (scope.clienteIds === null) return {};
  return {
    OR: [
      { assignment: assignmentScopeWhere(scope) },
      { assignmentId: null, fsr: fsrScopeWhere(scope) },
    ],
  };
}
