"use server";

import type { Prisma } from "@prisma/client";
import { AuditAction, AuditEntity, IncidentEventType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/log-audit";
import { requirePermission } from "@/lib/auth/auth";
import {
  getReportScope,
  incidentScopeWhere,
  type ReportScope,
} from "@/lib/auth/report-scope";
import { whereHasRole } from "@/lib/authz/user-queries";
import { getSlaState, type SlaState } from "@/lib/constants/sla-policy";
import { prisma } from "@/lib/database/prisma.singleton";
import { notifyAssignmentAssigned } from "@/lib/notifications/notify-events";
import { logger } from "@/lib/observability/logger";
import { getSlaHolidaySet } from "@/lib/sla/sla-holidays";
import {
  ASSIGNMENT_STATE,
  type AssignmentState,
  assertAssignmentPreconditions,
  assertAssignmentTransition,
  assertIncidentTransition,
  INCIDENT_STATE,
  INCIDENT_TERMINAL_STATES,
  type IncidentState,
  isAssignmentState,
  isIncidentState,
} from "@/lib/state-machine";
import {
  getIncidentClosureMap,
  logIncidentEvent,
  toIso,
} from "@/lib/state-machine/incident-events";
import { syncIncidentState } from "@/lib/state-machine/sync";
import { localWallTimeToUTC, mxDayRange } from "@/lib/utils/datetime";
import {
  BusinessRuleError,
  businessRule,
  guarded,
  ok,
  rejected,
} from "./result";

/**
 * Read a `datetime-local` value ("YYYY-MM-DDTHH:mm") as Mexico City time.
 * Falls back to plain parsing for anything already carrying a zone.
 */
function wallClockToUTC(value: string): Date {
  const [date, time] = value.split("T");
  if (!date || !time) return new Date(value);
  return localWallTimeToUTC(date, time.slice(0, 5));
}

/**
 * Errors that must reach the caller verbatim: business rules the user can act
 * on, and framework control-flow (Next `redirect()`/`notFound()`), which must
 * never be veiled as a generic failure. Everything else is wrapped, so an
 * unexpected fault does not leak internals into the UI.
 *
 * Classification is by type, never by message regex: a rule is a
 * `BusinessRuleError`, a redirect carries a `NEXT_REDIRECT` digest. Matching
 * on text (`/^(Solo se|Assignment not found|...)/`) rotted every time a
 * message was reworded and silently wrapped the rule it was meant to save.
 */
function rethrowBusinessError(error: unknown): void {
  if (error instanceof BusinessRuleError) throw error;
  if (
    error instanceof Error &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_")
  ) {
    throw error;
  }
}

const NOT_AN_FSR = "Uno o más FSR no existen o no tienen rol FSR";

/**
 * Terminal incidents are read-only. Every mutation enforces this so no
 * editor becomes the back door around cancellation/closure.
 *
 * Two shapes: guarded actions THROW via `assertIncidentMutable` (converted
 * to a return at the boundary); straight-line actions without `guarded`
 * RETURN `rejected(terminalIncidentMessage(...))` — throwing there would
 * veil the reason in production.
 */
function terminalIncidentMessage(incidentState: string | null): string | null {
  if (
    incidentState &&
    INCIDENT_TERMINAL_STATES.has(incidentState as IncidentState)
  ) {
    return incidentState === INCIDENT_STATE.CANCELADA
      ? "La incidencia está cancelada. No se pueden hacer cambios."
      : "La incidencia está cerrada. No se pueden hacer cambios.";
  }
  return null;
}

function assertIncidentMutable(incidentState: string | null): void {
  const blocked = terminalIncidentMessage(incidentState);
  if (blocked) businessRule(blocked);
}

/**
 * Assigning an FSR from Seguimiento also enables them on the incident.
 *
 * This screen used to reject anyone who was not already an `IncidentAssignee`,
 * while `createAssignment` only ever checked the FSR role — so the same person
 * could be picked when creating an assignment and refused when editing it.
 * Enabling on assign is the rule that survived; the two paths now agree.
 *
 * Enablement only ever grows here. Dropping an FSR from one assignment does not
 * revoke their `IncidentAssignee` row, because an incident can carry several
 * assignments and silently pulling their visibility of the whole incident is
 * not what "quitar de esta asignación" means.
 *
 * The §3.5(a) decision kept auto-create (LOG semantics): every implicit grant
 * appends an ASSIGNEE_AUTO_CREATED event, so the log shows who was enabled,
 * by whom, and through which assignment flow.
 */
async function enableFsrsOnIncident(
  tx: Prisma.TransactionClient,
  incidentId: number,
  userIds: string[],
  actorId?: string | null,
): Promise<void> {
  if (userIds.length === 0) return;
  const alreadyEnabled = await tx.incidentAssignee.findMany({
    where: { incidentId, userId: { in: userIds }, active: true },
    select: { userId: true },
  });
  const already = new Set(alreadyEnabled.map((r) => r.userId));
  for (const userId of userIds) {
    await tx.incidentAssignee.upsert({
      where: { incidentId_userId: { incidentId, userId } },
      update: { active: true },
      create: { incidentId, userId, active: true },
    });
    if (!already.has(userId)) {
      await logIncidentEvent(tx, {
        incidentId,
        eventType: IncidentEventType.ASSIGNEE_AUTO_CREATED,
        actorId: actorId ?? null,
        payload: { userId, via: "assignment" },
      });
    }
  }
}

/**
 * Tell the FSRs they were just given work.
 *
 * Seguimiento assigned people without ever notifying them — the mirror image of
 * the bug where incidents notified without assigning. A notification failure is
 * swallowed: the assignment is already committed and losing it to a mail
 * problem would be worse than a missing alert.
 */
async function notifyNewAssignees(
  assignmentId: string,
  incidentId: number,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { title: true },
    });
    await notifyAssignmentAssigned(
      assignmentId,
      incident?.title,
      recipientIds,
      actorId,
    );
  } catch (error) {
    logger.error("Error notifying new assignees:", error);
  }
}

/** Same check `createAssignment` runs, so both paths accept the same people. */
async function assertAreFsrs(userIds: string[]): Promise<boolean> {
  if (userIds.length === 0) return true;
  const fsrs = await prisma.user.findMany({
    where: { id: { in: userIds }, active: true, ...whereHasRole("FSR") },
    select: { id: true },
  });
  return fsrs.length === new Set(userIds).size;
}

type FolioQuery =
  | { kind: "incident"; value: number }
  | { kind: "assignment"; value: number }
  | { kind: "either"; value: number }
  | { kind: "none" };

function parseFolioQuery(input: string): FolioQuery {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "none" };

  const incMatch = trimmed.match(/^inc[-\s]?(\d+)$/i);
  if (incMatch) return { kind: "incident", value: Number(incMatch[1]) };

  const asMatch = trimmed.match(/^as[-\s]?(\d+)$/i);
  if (asMatch) return { kind: "assignment", value: Number(asMatch[1]) };

  if (/^\d+$/.test(trimmed)) {
    return { kind: "either", value: Number(trimmed) };
  }

  return { kind: "none" };
}

const TRACKING_MAX_RESULTS = 200;

export interface TrackingFilters {
  clientId?: string;
  typeId?: number;
  statusId?: number;
  startDate?: string;
  endDate?: string;
  assignedFsrId?: string;
  folio?: string;
}

/**
 * The one place the tracking filters turn into a query.
 *
 * `getIncidentsForTracking` and `getTrackingSignature` MUST agree on which rows
 * they are talking about: a signature computed over a different set than the
 * table shows would either miss changes or reload forever.
 *
 * The `scope` is the caller's Client boundary (cross-cutting rule #4:
 * non-ADMINISTRADOR users only see their Client data). An explicit
 * `clientId` filter narrows inside that boundary; one outside it matches
 * nothing (fail closed) instead of leaking another Client's rows.
 */
function buildTrackingWhere(
  filters: TrackingFilters | undefined,
  scope: ReportScope,
): {
  where: Prisma.IncidentWhereInput;
  assignmentsWhere: Prisma.AssignmentWhereInput;
} {
  const where: Prisma.IncidentWhereInput = {
    active: true,
  };

  if (filters?.clientId) {
    where.clientId =
      scope.clientIds !== null && !scope.clientIds.includes(filters.clientId)
        ? { in: [] }
        : filters.clientId;
  } else {
    Object.assign(where, incidentScopeWhere(scope));
  }

  if (filters?.typeId) {
    where.typeId = filters.typeId;
  }

  if (filters?.statusId) {
    where.statusId = filters.statusId;
  }

  if (filters?.startDate || filters?.endDate) {
    // CDMX day bounds, per the cross-cutting timezone rule. `new Date()` plus
    // setHours() resolved in the server's local zone — UTC on Vercel — so an
    // incident reported at 23:30 CDMX fell into the next day's filter.
    where.reportedAt = {};
    if (filters.startDate) {
      where.reportedAt.gte = mxDayRange(filters.startDate).gte;
    }
    if (filters.endDate) {
      where.reportedAt.lte = mxDayRange(filters.endDate).lte;
    }
  }

  const assignmentsWhere: Prisma.AssignmentWhereInput = { active: true };

  if (filters?.assignedFsrId) {
    assignmentsWhere.assignees = {
      some: { userId: filters.assignedFsrId, active: true },
    };
  }

  if (filters?.folio) {
    const parsed = parseFolioQuery(filters.folio);
    if (parsed.kind === "incident") {
      where.id = parsed.value;
    } else if (parsed.kind === "assignment") {
      assignmentsWhere.folio = parsed.value;
    } else if (parsed.kind === "either") {
      where.OR = [
        { id: parsed.value },
        {
          assignments: { some: { ...assignmentsWhere, folio: parsed.value } },
        },
      ];
    }
  }

  if (
    filters?.assignedFsrId ||
    (filters?.folio && assignmentsWhere.folio !== undefined)
  ) {
    where.assignments = {
      some: assignmentsWhere,
    };
  }

  return { where, assignmentsWhere };
}

/**
 * "Did anything change?" — the cheap question behind the auto-refresh.
 *
 * Four aggregates instead of 200 incidents with their nested assignments,
 * assignees and catalogues. The screen polls THIS; it only reloads the real
 * query when the answer differs from the last one it saw.
 *
 * The assignment half is not redundant: assigning an FSR, starting the work or
 * closing it touches the Assignment, never the Incident row, so an
 * incident-only signature would sit still through the changes operators care
 * about most. Counts catch soft deletes, which move a row out of the `active`
 * set without moving any `updatedAt` that remains inside it.
 */
export async function getTrackingSignature(filters?: TrackingFilters) {
  try {
    const user = await requirePermission("tracking:read");

    const { where, assignmentsWhere } = buildTrackingWhere(
      filters,
      await getReportScope(user),
    );
    const assignmentsOfThese: Prisma.AssignmentWhereInput = {
      ...assignmentsWhere,
      incident: where,
    };

    const [incidents, assignments] = await Promise.all([
      prisma.incident.aggregate({
        where,
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      prisma.assignment.aggregate({
        where: assignmentsOfThese,
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
    ]);

    return [
      incidents._count._all,
      incidents._max.updatedAt?.getTime() ?? 0,
      assignments._count._all,
      assignments._max.updatedAt?.getTime() ?? 0,
    ].join(":");
  } catch (error) {
    rethrowBusinessError(error);
    logger.error("Error computing tracking signature:", error);
    throw new Error("Failed to compute tracking signature");
  }
}

export async function getIncidentsForTracking(filters?: TrackingFilters) {
  try {
    const user = await requirePermission("tracking:read");

    const { where, assignmentsWhere } = buildTrackingWhere(
      filters,
      await getReportScope(user),
    );

    const incidentSelect = {
      id: true,
      title: true,
      description: true,
      reportedAt: true,
      resolvedAt: true,
      lineId: true,
      equipmentId: true,
      client: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      type: {
        select: {
          id: true,
          name: true,
          priority: true,
        },
      },
      status: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      line: {
        select: {
          id: true,
          name: true,
        },
      },
      assignees: {
        where: { active: true },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      assignments: {
        where: assignmentsWhere,
        select: {
          id: true,
          folio: true,
          notes: true,
          startedAt: true,
          finishedAt: true,
          seenAt: true,
          createdAt: true,
          assignees: {
            where: { active: true },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          status: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    } as const;

    const [totalCount, incidents] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        select: incidentSelect,
        orderBy: {
          reportedAt: "desc",
        },
        take: TRACKING_MAX_RESULTS,
      }),
    ]);

    // RF-218: one SLA state per row, computed on read. Two shared lookups for
    // the whole page — never per row: the RF-219 closure timestamps in bulk
    // (audit-trail precedence over the live `resolvedAt` column) and one
    // holiday set for the years spanned. An empty page skips both queries.
    const now = new Date();
    const [closureMap, holidays]: [Map<number, Date>, Set<string>] =
      incidents.length === 0
        ? [new Map<number, Date>(), new Set<string>()]
        : await Promise.all([
            getIncidentClosureMap(
              prisma,
              incidents.map((incident) => incident.id),
            ),
            getSlaHolidaySet(
              incidents.map((incident) => incident.reportedAt),
              now,
            ),
          ]);

    const data = incidents.map((incident) => {
      // Response clock runs to the first acuse on any active assignment.
      let firstSeenAt: Date | null = null;
      for (const assignment of incident.assignments) {
        if (
          assignment.seenAt &&
          (!firstSeenAt || assignment.seenAt < firstSeenAt)
        ) {
          firstSeenAt = assignment.seenAt;
        }
      }
      const sla: SlaState = getSlaState({
        priority: incident.type?.priority ?? 5,
        createdAt: incident.reportedAt,
        seenAt: firstSeenAt,
        resolvedAt: closureMap.get(incident.id) ?? incident.resolvedAt,
        statusName: incident.status?.name ?? null,
        now,
        holidays,
      });
      return { ...incident, sla };
    });

    return { data, totalCount };
  } catch (error) {
    rethrowBusinessError(error);
    logger.error("Error fetching incidents for tracking:", error);
    throw new Error("Failed to fetch incidents");
  }
}

/**
 * Every active FSR, each carrying the Clients they are assigned to.
 *
 * The Client link is a hint, not a filter: the UI surfaces it as a badge so an
 * operator can tell at a glance who usually covers that center, but anyone can
 * be assigned anywhere. This replaced a per-Client query that the tracking
 * page called once per Client and then de-duplicated.
 */
export async function getTrackingFsrs() {
  try {
    await requirePermission("tracking:read");

    const users = await prisma.user.findMany({
      where: { active: true, ...whereHasRole("FSR") },
      select: {
        id: true,
        name: true,
        email: true,
        clientAssignments: {
          where: { active: true },
          select: { clientId: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      clientIds: u.clientAssignments.map((a) => a.clientId),
    }));
  } catch (error) {
    rethrowBusinessError(error);
    logger.error("Error fetching FSRs for tracking:", error);
    throw new Error("Failed to fetch FSRs");
  }
}

export async function assignFSRToIncident(incidentId: number, fsrId: string) {
  try {
    const actor = await requirePermission("tracking:update");

    if (!(await assertAreFsrs([fsrId]))) {
      return rejected(NOT_AN_FSR);
    }

    const { assignmentId, added } = await prisma.$transaction(async (tx) => {
      await enableFsrsOnIncident(tx, incidentId, [fsrId], actor.id);

      const existingAssignment = await tx.assignment.findFirst({
        where: { incidentId, active: true },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      if (existingAssignment) {
        const previous = await tx.assignmentAssignee.findUnique({
          where: {
            assignmentId_userId: {
              assignmentId: existingAssignment.id,
              userId: fsrId,
            },
          },
          select: { active: true },
        });
        await tx.assignmentAssignee.upsert({
          where: {
            assignmentId_userId: {
              assignmentId: existingAssignment.id,
              userId: fsrId,
            },
          },
          update: { active: true },
          create: {
            assignmentId: existingAssignment.id,
            userId: fsrId,
            active: true,
          },
        });
        await syncIncidentState(incidentId, tx);
        return {
          assignmentId: existingAssignment.id,
          added: !previous?.active,
        };
      }

      const initialStatus = await tx.assignmentStatus.findFirst({
        where: { name: "ASIGNADO" },
      });

      const created = await tx.assignment.create({
        data: {
          incidentId,
          statusId: initialStatus?.id,
          assignedAt: new Date(),
          assignees: { create: [{ userId: fsrId }] },
        },
        select: { id: true },
      });
      await syncIncidentState(incidentId, tx);
      return { assignmentId: created.id, added: true };
    });

    if (added) {
      await notifyNewAssignees(assignmentId, incidentId, [fsrId], actor.id);
    }

    revalidatePath("/admin/tracking");
    return ok();
  } catch (error) {
    rethrowBusinessError(error);
    logger.error("Error assigning FSR to incident:", error);
    throw new Error("Failed to assign FSR");
  }
}

export async function updateAssignmentAssignees(
  assignmentId: string,
  userIds: string[],
) {
  try {
    const actor = await requirePermission("tracking:update");

    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        incidentId: true,
        incident: { select: { status: { select: { name: true } } } },
      },
    });
    if (!assignment) {
      return rejected("La asignación ya no existe.");
    }
    const terminalBlock = terminalIncidentMessage(
      assignment.incident?.status?.name ?? null,
    );
    if (terminalBlock) return rejected(terminalBlock);
    if (!(await assertAreFsrs(uniqueIds))) {
      return rejected(NOT_AN_FSR);
    }

    const added = await prisma.$transaction(async (tx) => {
      const existing = await tx.assignmentAssignee.findMany({
        where: { assignmentId },
        select: { userId: true, active: true },
      });

      const existingActive = new Set(
        existing.filter((e) => e.active).map((e) => e.userId),
      );
      const requested = new Set(uniqueIds);

      const toRemove = [...existingActive].filter((u) => !requested.has(u));
      const toAdd = uniqueIds.filter((u) => !existingActive.has(u));

      if (toRemove.length > 0) {
        await tx.assignmentAssignee.updateMany({
          where: { assignmentId, userId: { in: toRemove } },
          data: { active: false },
        });
      }

      for (const userId of toAdd) {
        await tx.assignmentAssignee.upsert({
          where: { assignmentId_userId: { assignmentId, userId } },
          update: { active: true },
          create: { assignmentId, userId, active: true },
        });
      }

      await enableFsrsOnIncident(tx, assignment.incidentId, toAdd, actor.id);

      return toAdd;
    });

    // Only the newcomers. Re-saving an unchanged assignment must not spam
    // everyone who was already on it.
    if (added.length > 0) {
      await notifyNewAssignees(
        assignmentId,
        assignment.incidentId,
        added,
        actor.id,
      );
    }

    const updatedAssignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        assignees: {
          where: { active: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/admin/tracking");
    return ok({ assignment: updatedAssignment });
  } catch (error) {
    rethrowBusinessError(error);
    logger.error("Error updating assignment assignees:", error);
    throw new Error("Failed to update assignment assignees");
  }
}

export async function updateIncidentDetails(
  incidentId: number,
  data: {
    title: string;
    description: string;
    reportedAt: string;
    resolvedAt?: string | null;
    statusId: number;
    lineId?: number | null;
    equipmentId?: number | null;
  },
) {
  // RF-550: the actor is explicit — no AsyncLocalStorage across the
  // Server-Action boundary.
  const { id: actorId } = await requirePermission("tracking:update");

  return guarded(async () => {
    try {
      const incident = await prisma.incident.findUnique({
        where: { id: incidentId },
        select: {
          statusId: true,
          status: { select: { name: true } },
          assignments: {
            where: { active: true },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!incident) businessRule("La incidencia ya no existe.");
      assertIncidentMutable(incident.status?.name ?? null);

      // The status field is machine-owned: the edit may only walk a legal
      // edge, never jump. Cancellation has its own action (it records
      // cancelledAt + reason), so it is refused here.
      const from = incident.status?.name ?? null;
      const target = data.statusId
        ? await prisma.incidentStatus.findUnique({
            where: { id: data.statusId },
            select: { name: true },
          })
        : null;
      // `isIncidentState` validates at runtime; the cast below only satisfies
      // the compiler, which cannot narrow through the optional chain.
      const toName = target?.name ?? null;
      if (data.statusId && !isIncidentState(toName)) {
        businessRule("Estado de incidencia no válido.");
      }
      if (toName && from && toName !== from) {
        if (toName === INCIDENT_STATE.CANCELADA) {
          businessRule(
            "Para cancelar una incidencia usa la acción de cancelación.",
          );
        }
        assertIncidentTransition(
          from as IncidentState,
          toName as IncidentState,
        );
      }

      await prisma.incident.update({
        where: { id: incidentId },
        data: {
          title: data.title,
          description: data.description,
          // The form sends a CDMX wall clock ("YYYY-MM-DDTHH:mm"). `new Date()`
          // would read it in the server's zone — UTC in production — and shift
          // every edited timestamp by the offset.
          reportedAt: wallClockToUTC(data.reportedAt),
          resolvedAt: data.resolvedAt ? wallClockToUTC(data.resolvedAt) : null,
          statusId: target ? data.statusId : incident.statusId,
          lineId: data.lineId || null,
          equipmentId: data.equipmentId || null,
          updatedById: actorId,
        },
      });

      // RF-553: scalar edits ARE auditable management — the sync below (if
      // any) owns the status transition in IncidentEvent, this row owns the
      // attributable edit. Free text stays out (allowlist holds IDs only).
      await logAudit(prisma, {
        actorId,
        entity: AuditEntity.INCIDENT,
        entityId: String(incidentId),
        action: AuditAction.UPDATE,
        payload: {
          statusId: target ? data.statusId : incident.statusId,
          lineId: data.lineId || null,
          equipmentId: data.equipmentId || null,
        },
      });

      // Incident state is derived from its assignments: when any exist, sync
      // reconciles the manual edit (a forced CERRADO with open assignments
      // snaps back instead of lying). With no assignments there is nothing to
      // derive from, so the validated manual state stands.
      if (incident.assignments.length > 0) {
        await syncIncidentState(incidentId);
      }

      revalidatePath("/admin/tracking");
      return ok();
    } catch (error) {
      rethrowBusinessError(error);
      // Business rules must reach `guarded` as exceptions so they are
      // RETURNED to the operator — not veiled as a generic failure.
      if (error instanceof BusinessRuleError) throw error;
      logger.error("Error updating incident:", error);
      throw new Error("Failed to update incident");
    }
  });
}

/**
 * Tracking admin override (RF-219 §1.3 mechanism).
 *
 * The §1.3 override decision is only safe once every override is recorded:
 * this action sets the incident status directly — bypassing the derived-state
 * sync and the allowed-edge table — and appends an ADMIN_OVERRIDE event with
 * the actor, the from→to edge, and the mandatory reason in the same
 * transaction. The permission itself ships with §1.3; the audit mechanism
 * ships here.
 *
 * Rules: the reason is mandatory (an unexplained override defeats the log);
 * CANCELADA is never a target (use `cancelIncident`) and never a source
 * (terminal and irreversible).
 */
export async function overrideIncidentStatus(
  incidentId: number,
  toStatusName: string,
  reason: string,
) {
  const actor = await requirePermission("tracking:update");

  return guarded(async () => {
    const trimmedReason = reason?.trim() ?? "";
    if (!trimmedReason) {
      businessRule(
        "El motivo es obligatorio: queda registrado en la bitácora.",
      );
    }
    if (!isIncidentState(toStatusName)) {
      businessRule("Estado de incidencia no válido.");
    }
    if (toStatusName === INCIDENT_STATE.CANCELADA) {
      businessRule(
        "Para cancelar una incidencia usa la acción de cancelación.",
      );
    }

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        status: { select: { name: true } },
        resolvedAt: true,
      },
    });
    if (!incident) businessRule("La incidencia ya no existe.");
    const from = incident.status?.name ?? null;
    if (from === INCIDENT_STATE.CANCELADA) {
      businessRule("La incidencia está cancelada. No se pueden hacer cambios.");
    }
    if (from === toStatusName) {
      businessRule(`La incidencia ya está en ${toStatusName}.`);
    }

    const target = await prisma.incidentStatus.findUnique({
      where: { name: toStatusName },
      select: { id: true },
    });
    if (!target) {
      throw new Error(
        `IncidentStatus '${toStatusName}' no existe en el catálogo`,
      );
    }

    const resolvedAt =
      toStatusName === INCIDENT_STATE.CERRADO ? new Date() : null;
    await prisma.$transaction(async (tx) => {
      await tx.incident.update({
        where: { id: incidentId },
        data: { statusId: target.id, resolvedAt },
      });
      await logIncidentEvent(tx, {
        incidentId,
        eventType: IncidentEventType.ADMIN_OVERRIDE,
        actorId: actor.id,
        fromStatus: from,
        toStatus: toStatusName,
        payload: {
          reason: trimmedReason,
          fromStatus: from,
          toStatus: toStatusName,
          priorResolvedAt: toIso(incident.resolvedAt),
        },
      });
    });

    revalidatePath("/admin/tracking");
    revalidatePath("/admin/incidents");
    revalidatePath(`/admin/incidents/${incidentId}`);
    return ok({ before: from, after: toStatusName });
  });
}

export async function updateAssignmentDetails(
  assignmentId: string,
  data: {
    statusId?: number | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  },
) {
  await requirePermission("tracking:update");

  return guarded(async () => {
    try {
      const row = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: {
          incidentId: true,
          status: { select: { name: true } },
          startedAt: true,
          finishedAt: true,
          startLatitude: true,
          startLongitude: true,
          endLatitude: true,
          endLongitude: true,
          odtFolio: true,
          incident: { select: { status: { select: { name: true } } } },
        },
      });
      if (!row) businessRule("La asignación ya no existe.");

      // Assignments of a terminal incident are read-only: every other
      // assignment mutation enforces this, and the tracking editor must not
      // be the back door.
      assertIncidentMutable(row.incident?.status?.name ?? null);

      // CDMX wall clock, like `updateIncidentDetails` above. A plain `new Date()`
      // reads "YYYY-MM-DDTHH:mm" in the SERVER's zone — UTC on Vercel — so the
      // hour the operator typed was stored six hours off.
      const startedAt = data.startedAt ? wallClockToUTC(data.startedAt) : null;
      const finishedAt = data.finishedAt
        ? wallClockToUTC(data.finishedAt)
        : null;

      const target = data.statusId
        ? await prisma.assignmentStatus.findUnique({
            where: { id: data.statusId },
            select: { name: true },
          })
        : null;
      if (data.statusId && !isAssignmentState(target?.name)) {
        businessRule("Estado de asignación no válido.");
      }

      // The dates are what the state means, so they are checked together with it.
      // Closing an assignment with no end date leaves a finished job that never
      // finished, and every report that measures duration silently skips it.
      if (target?.name) {
        const name = target.name;

        if (name === ASSIGNMENT_STATE.CERRADO && !finishedAt) {
          return rejected(
            "No se puede cerrar la asignación sin fecha de fin. Captúrala primero.",
          );
        }
        if (
          (name === ASSIGNMENT_STATE.INICIADO ||
            name === ASSIGNMENT_STATE.EN_PROGRESO ||
            name === ASSIGNMENT_STATE.CERRADO) &&
          !startedAt
        ) {
          return rejected(
            `No se puede marcar como ${name} sin fecha de inicio. Captúrala primero.`,
          );
        }
        if (startedAt && finishedAt && finishedAt < startedAt) {
          return rejected(
            "La fecha de fin no puede ser anterior a la de inicio.",
          );
        }
      }

      // The status field is machine-owned: the edit may only walk a legal
      // edge, and the GPS/evidence/ODT preconditions of the target state are
      // evaluated against the resulting row — this form writes no GPS columns
      // and no evidence, so closing or starting work from here fails unless
      // the dedicated actions already recorded them.
      const from = row.status?.name ?? null;
      const to = (target?.name ?? from) as AssignmentState | null;
      if (from && to && from !== to) {
        assertAssignmentTransition(from as AssignmentState, to);
      }
      if (to) {
        const attachmentCount =
          to === ASSIGNMENT_STATE.CERRADO
            ? await prisma.assignmentAttachment.count({
                where: { assignmentId, active: true },
              })
            : 0;
        assertAssignmentPreconditions(to, {
          startedAt,
          finishedAt,
          startLatitude: row.startLatitude,
          startLongitude: row.startLongitude,
          endLatitude: row.endLatitude,
          endLongitude: row.endLongitude,
          attachmentCount,
          odtFolio: row.odtFolio,
        });
      }

      await prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          statusId: data.statusId || null,
          startedAt,
          finishedAt,
        },
      });

      // Incident state derives from its assignments — reconcile it.
      await syncIncidentState(row.incidentId);

      revalidatePath("/admin/tracking");
      return ok();
    } catch (error) {
      rethrowBusinessError(error);
      // Business rules must reach `guarded` as exceptions so they are
      // RETURNED to the operator — not veiled as a generic failure.
      if (error instanceof BusinessRuleError) throw error;
      logger.error("Error updating assignment:", error);
      throw new Error("Failed to update assignment");
    }
  });
}

/**
 * Everything the tracking screen needs before it can draw its filters.
 *
 * One call instead of four. Server Actions are POSTs and Next does not run them
 * in parallel the way `fetch` would, so four separate round trips on mount cost
 * four times the latency before anything renders — on top of the incident query
 * that runs beside them.
 */
export async function getTrackingBootstrap() {
  await requirePermission("tracking:read");

  const [clients, types, statuses, fsrs] = await Promise.all([
    prisma.client.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.incidentType.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.incidentStatus.findMany({
      where: { active: true },
      select: { id: true, name: true, color: true },
      orderBy: { id: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true, ...whereHasRole("FSR") },
      select: {
        id: true,
        name: true,
        email: true,
        clientAssignments: {
          where: { active: true },
          select: { clientId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    clients,
    types,
    statuses,
    fsrs: fsrs.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      clientIds: u.clientAssignments.map((a) => a.clientId),
    })),
  };
}
