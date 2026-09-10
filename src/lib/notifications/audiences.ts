import type { Prisma } from "@prisma/client";
import { SCOPE_ALL_CLIENTS } from "@/lib/authz/authz";
import {
  getUserIdsWithPermission,
  whereHasPermission,
  whereHasRoleId,
} from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";

/**
 * Audiences, addressed by capability rather than by role name.
 *
 * There used to be a single `getAdminUserIds()` meaning "every ADMINISTRADOR".
 * When that role split into ROOT, ADMIN_OPERACION and ADMIN_VACACIONES, keeping
 * one list sent vacation requests to the operations administrators — who cannot
 * approve them — while the people who can never heard about them. Who is
 * notified must follow who can ACT, so each audience names its capability.
 *
 * Every resolver fails closed: a DB error notifies nobody instead of rolling
 * back the business operation that triggered it.
 */

/**
 * Who operates on incidents, scoped to one Client.
 *
 * Two conditions, both required: holding `incidents:assign` (what ROOT and
 * ADMIN_OPERACION have — FSR only holds `incidents:update`, so field staff
 * stop getting mailed about other centers' incidents) AND reaching the
 * Client, either through the cross-Client scope or through an active
 * assignment to it. A null Client (unassigned incident) only reaches the
 * scope holders. Fail closed throughout.
 */
export async function operationsAudience(
  clientId: string | null | undefined,
): Promise<string[]> {
  const where: Prisma.UserWhereInput = {
    active: true,
    ...whereHasPermission("incidents:assign"),
    OR: [
      whereHasPermission(SCOPE_ALL_CLIENTS),
      ...(clientId
        ? [
            {
              clientAssignments: {
                some: { active: true, clientId },
              },
            } satisfies Prisma.UserWhereInput,
          ]
        : []),
    ],
  };
  // Never throws: a failed audience lookup notifies nobody instead of
  // rolling back the business operation that triggered it.
  try {
    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    });
    return users.map((u) => u.id);
  } catch (error) {
    logger.error("[audiences] Error resolving operations audience:", error);
    return [];
  }
}

/** Only someone who can approve a vacation needs to know one is waiting. */
const VACATION_APPROVERS = "vacations:approve";

/** Whoever decides on a vacation request. */
export async function getVacationApprovers(): Promise<string[]> {
  return getUserIdsWithPermission(VACATION_APPROVERS);
}

/** Capability twin of `getVacationApprovers`, for dispatch-time resolution. */
export async function vacationApprovers(): Promise<string[]> {
  try {
    return await getUserIdsWithPermission(VACATION_APPROVERS);
  } catch (error) {
    logger.error("[audiences] Error resolving vacation approvers:", error);
    return [];
  }
}

export interface IncidentStakeholdersInput {
  incidentId: number;
  clientId: string | null | undefined;
  reporterId: string | null | undefined;
}

/**
 * Everyone with a stake in an incident: whoever reported it, the FSRs
 * enabled on it (active `IncidentAssignee` rows), and the operations
 * audience of its Client. Deduped; never throws.
 */
export async function incidentStakeholders(
  input: IncidentStakeholdersInput,
): Promise<string[]> {
  try {
    const [assignees, operations] = await Promise.all([
      prisma.incidentAssignee.findMany({
        where: { incidentId: input.incidentId, active: true },
        select: { userId: true },
      }),
      operationsAudience(input.clientId),
    ]);
    const ids = new Set<string>([
      ...(input.reporterId ? [input.reporterId] : []),
      ...assignees.map((a) => a.userId),
      ...operations,
    ]);
    return [...ids];
  } catch (error) {
    logger.error("[audiences] Error resolving incident stakeholders:", error);
    return [];
  }
}

export interface BroadcastAudienceInput {
  /** Target role ids. Ignored when `all` is true. */
  roleIds: number[];
  /** Every active user. The sender still opts in separately. */
  all: boolean;
}

/**
 * Users holding any of the target roles (or every active user for `all`).
 * Fail closed: a sender role with no targets reaches nobody, and a lookup
 * failure resolves to nobody rather than to everybody.
 */
export async function broadcastAudience(
  input: BroadcastAudienceInput,
): Promise<string[]> {
  try {
    if (input.all) {
      const users = await prisma.user.findMany({
        where: { active: true },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (input.roleIds.length === 0) return [];
    const users = await prisma.user.findMany({
      where: {
        active: true,
        OR: input.roleIds.map((roleId) => whereHasRoleId(roleId)),
      },
      select: { id: true },
    });
    return [...new Set(users.map((u) => u.id))];
  } catch (error) {
    logger.error("[audiences] Error resolving broadcast audience:", error);
    return [];
  }
}
