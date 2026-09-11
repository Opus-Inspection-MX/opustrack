/**
 * Multi-tenancy scoping for reports and the dashboard.
 *
 * Reports aggregate across several entities, each reaching the Client by a
 * different path. These helpers turn one resolved scope into the correct
 * Prisma `where` fragment per entity, so every report applies the same rule
 * (cross-cutting rule #4: non-ADMINISTRADOR users only see their Client data).
 *
 * Fail closed: a user with no Client assignment matches nothing rather than
 * everything.
 */

import type { Prisma } from "@prisma/client";
import type { UserWithPermissions } from "@/lib/authz/authz";
import { getUserClientIds } from "@/lib/utils/client-assignments";
import { clientInScope } from "./access";
import { isAdmin } from "./filters";

export interface ReportScope {
  /** `null` means unrestricted (ADMINISTRADOR). */
  clientIds: string[] | null;
}

/** Resolve the Client scope of the current user. */
export async function getReportScope(
  user: UserWithPermissions,
): Promise<ReportScope> {
  if (isAdmin(user)) return { clientIds: null };

  const clientIds = await getUserClientIds(user.id);
  if (clientIds.length > 0) return { clientIds };

  // Fail closed: no assignments match nothing. (The deprecated
  // User.clienteId scalar fallback died with the column.)
  return { clientIds: [] };
}

/** Incident: owns `clientId` directly. */
export function incidentScopeWhere(
  scope: ReportScope,
): Prisma.IncidentWhereInput {
  if (scope.clientIds === null) return {};
  return { clientId: { in: scope.clientIds } };
}

/** Assignment: reaches the Client through its incident. */
export function assignmentScopeWhere(
  scope: ReportScope,
): Prisma.AssignmentWhereInput {
  if (scope.clientIds === null) return {};
  return { incident: incidentScopeWhere(scope) };
}

/**
 * Schedule: reaches the Client through the M:N ScheduleClient link.
 *
 * Schedules with no active Client links are global and stay visible to any
 * scoped user — the same rule `getIncidentFormOptions` already applied. Fail
 * closed is preserved: a scope of zero Clients matches nothing, not even
 * global schedules.
 */
export function scheduleScopeWhere(
  scope: ReportScope,
): Prisma.ScheduleWhereInput {
  if (scope.clientIds === null) return {};
  if (scope.clientIds.length === 0) {
    return { clients: { some: { clientId: { in: [] } } } };
  }
  return {
    OR: [
      {
        clients: {
          some: { active: true, clientId: { in: scope.clientIds } },
        },
      },
      { clients: { none: { active: true } } },
    ],
  };
}

/**
 * Compose a caller filter with a scope fragment so the scope can never be
 * overwritten (H-02, H-18).
 *
 * Spreading (`{...scopeWhere, ...filters}` in either order) lets one side
 * replace the other's `clientId` key; the comment then claims the opposite.
 * `AND` keeps both: the caller filter narrows INSIDE the scope, never
 * outside it. Returns `where` untouched when the scope is unrestricted (`{}`).
 */
export function withScope<T extends object>(where: T, scopeWhere: object): T {
  if (Object.keys(scopeWhere).length === 0) return where;
  return { AND: [where, scopeWhere] } as T;
}

/**
 * Sync membership check against an already-resolved scope.
 *
 * For sync callbacks (`Array.some`, `Array.filter`) where the async
 * `canAccessClientAsync` cannot run. Resolve the scope once with
 * `getReportScope` and reuse it for every element. Delegates to the single
 * fail-closed rule in `auth/access.ts` (H-05): `null` is only reachable with
 * an unrestricted scope.
 */
export function scopeIncludesClient(
  scope: ReportScope,
  clientId: string | null,
): boolean {
  return clientInScope(scope, clientId);
}

/** User (FSR): scoped by their active Client assignments. */
export function fsrScopeWhere(scope: ReportScope): Prisma.UserWhereInput {
  if (scope.clientIds === null) return {};
  return {
    clientAssignments: {
      some: { active: true, clientId: { in: scope.clientIds } },
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
  if (scope.clientIds === null) return {};
  return {
    OR: [
      { assignment: assignmentScopeWhere(scope) },
      { assignmentId: null, fsr: fsrScopeWhere(scope) },
    ],
  };
}
