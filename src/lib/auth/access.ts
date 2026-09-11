/**
 * Per-id access guards (Fase 0c: H-03, H-04, H-05).
 *
 * A Server Action is a public POST endpoint for any session: the middleware
 * never filters it by route, and "the screen does not offer it" protects
 * nothing. So every action that receives an id must prove the record belongs
 * to the caller's Client scope (or that the caller owns it) — permission
 * alone is not enough.
 *
 * Plain module, NOT `"use server"`: these loaders run inside actions but must
 * never become public actions themselves. They return the record or raise
 * `businessRule(...)`, which `guarded(...)` converts into a returned
 * rejection at the action boundary (production-safe, unlike a throw).
 *
 * Single fail-closed rule: `clientInScope`. A `null` clientId is only
 * reachable with an unrestricted scope — `canAccessClientAsync` and
 * `scopeIncludesClient` delegate here, so the old "Client-less users see
 * Client-less records" backdoor is gone (H-05).
 */

import { businessRule } from "@/lib/actions/result";
import {
  SCOPE_ALL_CLIENTS,
  userHasPermission,
  type UserWithPermissions,
} from "@/lib/authz/authz";
import { whereHasPermission } from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import { getUserClientIds } from "@/lib/utils/client-assignments";
import type { ReportScope } from "./report-scope";

/**
 * The one rule for "may this scope see this Client's data".
 *
 * Fail closed: anything not explicitly in scope is denied, and `null` (a
 * record filed under no Client) is only visible to an unrestricted scope.
 * There is no "Client-less user sees Client-less records" fallback — a user
 * with no assignments matches nothing, like every other listing.
 */
export function clientInScope(
  scope: ReportScope,
  clientId: string | null,
): boolean {
  if (scope.clientIds === null) return true;
  if (clientId === null) return false;
  return scope.clientIds.includes(clientId);
}

/**
 * Resolve the caller's scope without importing `report-scope.ts`.
 *
 * Same rule as `getReportScope`: scope holders are unrestricted, everyone
 * else is limited to their assignments, and no assignment matches nothing.
 * It lives here (instead of importing `getReportScope`) so this module never
 * forms a `filters <-> report-scope <-> access` import cycle — both of those
 * modules delegate their checks HERE. Parity with `getReportScope` is pinned
 * by `access.test.ts`.
 */
async function scopeOf(user: UserWithPermissions): Promise<ReportScope> {
  if (userHasPermission(user, SCOPE_ALL_CLIENTS)) return { clientIds: null };
  return { clientIds: await getUserClientIds(user.id) };
}

/**
 * Deny with an operator-facing message unless the Client is in scope.
 */
export async function requireClientAccess(
  user: UserWithPermissions,
  clientId: string | null,
): Promise<void> {
  if (!clientInScope(await scopeOf(user), clientId)) {
    businessRule("Sin acceso a los datos de este Cliente.");
  }
}

/**
 * Load an active incident the caller may see, or raise.
 *
 * "No encontrado." covers both the missing row and the out-of-scope row on
 * purpose: confirming which one would leak another Client's data.
 */
export async function loadIncidentFor(
  user: UserWithPermissions,
  incidentId: number,
) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, active: true },
    select: { id: true, clientId: true },
  });
  if (!incident) {
    businessRule("No encontrado.");
  }
  await requireClientAccess(user, incident.clientId);
  return incident;
}

export type AssignmentAccessMode = "reader" | "worker" | "manager";

/**
 * Load an active assignment the caller may touch, or raise.
 *
 * Every mode requires `active` plus the incident's Client in scope (H-17: a
 * soft-deleted assignment stays editable otherwise). On top of that:
 *
 * - `reader`: seeing is enough (detail screens, lists).
 * - `worker`: the caller must be assigned to it, unless they can override
 *   anyone's assignment (`assignments:manage-all`).
 * - `manager`: the caller must hold `assignments:manage-all` — reassigning
 *   technicians, dates and folios of ANY assignment is administration, not
 *   field work (H-04).
 */
export async function loadAssignmentFor(
  user: UserWithPermissions,
  assignmentId: string,
  mode: AssignmentAccessMode,
) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, active: true },
    select: {
      id: true,
      incidentId: true,
      status: { select: { name: true } },
      incident: { select: { clientId: true } },
      assignees: { where: { active: true }, select: { userId: true } },
    },
  });
  if (!assignment) {
    businessRule("No encontrado.");
  }
  await requireClientAccess(user, assignment.incident.clientId);
  if (mode === "worker") {
    await ensureCallerIsAssigneeOrAdmin(user.id, assignment.assignees);
  } else if (mode === "manager") {
    await ensureCallerManagesAll(user.id);
  }
  return assignment;
}

/**
 * Overriding someone else's assignment is a capability, not a role name: an
 * operations admin needs it, a vacation admin must not have it.
 *
 * (Moved here from `actions/assignments.ts` so every worker-mode entry point
 * shares the one check instead of re-implementing it.)
 */
export async function ensureCallerIsAssigneeOrAdmin(
  callerId: string,
  assignees: { userId: string }[],
): Promise<boolean> {
  const isAssignee = assignees.some((a) => a.userId === callerId);
  if (isAssignee) return true;
  const override = await prisma.user.count({
    where: { id: callerId, ...whereHasPermission("assignments:manage-all") },
  });
  if (override > 0) return true;
  businessRule(
    "Solo un FSR asignado o un administrador puede ejecutar esta acción",
  );
}

/**
 * Manager capability for assignments: may edit assignments they are not
 * assigned to. Checked against the database (like the worker override above)
 * rather than the JWT, so a just-granted permission applies immediately.
 */
async function ensureCallerManagesAll(callerId: string): Promise<void> {
  const override = await prisma.user.count({
    where: { id: callerId, ...whereHasPermission("assignments:manage-all") },
  });
  if (override === 0) {
    businessRule("Solo un administrador puede editar esta asignación.");
  }
}

/**
 * Load an active line the caller may see, or raise. Lines reach their Client
 * directly via `line.clientId`.
 */
export async function loadLineFor(
  user: UserWithPermissions,
  lineId: number,
) {
  const line = await prisma.line.findFirst({
    where: { id: lineId, active: true },
    select: { id: true, clientId: true },
  });
  if (!line) {
    businessRule("No encontrado.");
  }
  await requireClientAccess(user, line.clientId);
  return line;
}

/**
 * Load an active equipment the caller may see, or raise. Equipment reaches
 * its Client through its line.
 */
export async function loadEquipmentFor(
  user: UserWithPermissions,
  equipmentId: number,
) {
  const equipment = await prisma.equipment.findFirst({
    where: { id: equipmentId, active: true },
    select: { id: true, lineId: true, line: { select: { clientId: true } } },
  });
  if (!equipment) {
    businessRule("No encontrado.");
  }
  await requireClientAccess(user, equipment.line.clientId);
  return equipment;
}

export type ClientRefs = {
  lineId?: number | null;
  equipmentId?: number | null;
  scheduleId?: string | null;
};

/**
 * Prove each referenced row belongs to `clientId`, or raise.
 *
 * Reference ids arrive from the client and are never trustworthy: without
 * this, an incident filed under Client A can point at Client B's line,
 * equipment or schedule (H-04). A global schedule (no active Client links)
 * belongs everywhere — the same rule `scheduleScopeWhere` reads by; a linked
 * one must include this Client. Mismatches report "No encontrado.": from the
 * caller's scope that row does not exist.
 */
export async function assertBelongsToClient(
  refs: ClientRefs,
  clientId: string | null,
): Promise<void> {
  if (refs.lineId != null) {
    const line = await prisma.line.findFirst({
      where: { id: refs.lineId, active: true },
      select: { clientId: true },
    });
    if (!line || line.clientId !== clientId) {
      businessRule("No encontrado.");
    }
  }
  if (refs.equipmentId != null) {
    const equipment = await prisma.equipment.findFirst({
      where: { id: refs.equipmentId, active: true },
      select: { line: { select: { clientId: true } } },
    });
    if (!equipment || equipment.line.clientId !== clientId) {
      businessRule("No encontrado.");
    }
  }
  if (refs.scheduleId != null) {
    const schedule = await prisma.schedule.findFirst({
      where: { id: refs.scheduleId, active: true },
      select: {
        clients: { where: { active: true }, select: { clientId: true } },
      },
    });
    if (!schedule) {
      businessRule("No encontrado.");
    }
    const linked = schedule.clients.map((c) => c.clientId);
    if (
      linked.length > 0 &&
      (clientId === null || !linked.includes(clientId))
    ) {
      businessRule("No encontrado.");
    }
  }
}
