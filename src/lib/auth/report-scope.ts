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

  // Fail closed: no assignments match nothing. (The deprecated
  // User.clienteId scalar fallback died with the column.)
  return { clienteIds: [] };
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

/**
 * Schedule: reaches the Cliente through the M:N ScheduleCliente link.
 *
 * Schedules with no active Cliente links are global and stay visible to any
 * scoped user — the same rule `getIncidentFormOptions` already applied. Fail
 * closed is preserved: a scope of zero Clientes matches nothing, not even
 * global schedules.
 */
export function scheduleScopeWhere(
  scope: ReportScope,
): Prisma.ScheduleWhereInput {
  if (scope.clienteIds === null) return {};
  if (scope.clienteIds.length === 0) {
    return { clientes: { some: { clienteId: { in: [] } } } };
  }
  return {
    OR: [
      {
        clientes: {
          some: { active: true, clienteId: { in: scope.clienteIds } },
        },
      },
      { clientes: { none: { active: true } } },
    ],
  };
}

/**
 * Sync membership check against an already-resolved scope.
 *
 * For sync callbacks (`Array.some`, `Array.filter`) where the async
 * `canAccessClienteAsync` cannot run. Resolve the scope once with
 * `getReportScope` and reuse it for every element. Equivalent to
 * `canAccessClienteAsync` for non-null ids, including the legacy fallback.
 */
export function scopeIncludesCliente(
  scope: ReportScope,
  clienteId: string | null,
): boolean {
  if (scope.clienteIds === null) return true;
  if (clienteId === null) return scope.clienteIds.length === 0;
  return scope.clienteIds.includes(clienteId);
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
