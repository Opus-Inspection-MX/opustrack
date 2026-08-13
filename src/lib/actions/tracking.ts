"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { notifyAssignmentAssigned } from "@/lib/notifications/notify-events";
import { syncIncidentState } from "@/lib/state-machine/sync";
import { localWallTimeToUTC, mxDayRange } from "@/lib/utils/datetime";

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
 * on, and permission failures. Everything else is wrapped, so an unexpected
 * fault does not leak internals into the UI.
 *
 * The catch-all used to replace *every* error with a generic message, so a rule
 * fired correctly and the user never saw why — and a denied permission looked
 * like a server fault.
 */
function rethrowBusinessError(error: unknown): void {
  if (
    error instanceof Error &&
    /^(Solo se|Assignment not found|Unauthorized|Forbidden)/.test(error.message)
  ) {
    throw error;
  }
}

/**
 * A rejection the user is meant to read.
 *
 * It is RETURNED, not thrown, because a production build of Next replaces the
 * message of anything a Server Action throws with "An error occurred in the
 * Server Components render… the specific message is omitted in production
 * builds". Re-throwing the rule reaches the caller in dev and disappears in
 * production — which is exactly where it matters. A returned value crosses the
 * boundary untouched.
 */
function rejected(message: string) {
  return { success: false as const, error: message };
}

const NOT_AN_FSR = "Uno o más FSR no existen o no tienen rol FSR";

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
 */
async function enableFsrsOnIncident(
  tx: Prisma.TransactionClient,
  incidentId: number,
  userIds: string[],
): Promise<void> {
  for (const userId of userIds) {
    await tx.incidentAssignee.upsert({
      where: { incidentId_userId: { incidentId, userId } },
      update: { active: true },
      create: { incidentId, userId, active: true },
    });
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
    console.error("Error notifying new assignees:", error);
  }
}

/** Same check `createAssignment` runs, so both paths accept the same people. */
async function assertAreFsrs(userIds: string[]): Promise<boolean> {
  if (userIds.length === 0) return true;
  const fsrs = await prisma.user.findMany({
    where: { id: { in: userIds }, active: true, role: { name: "FSR" } },
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

export async function getIncidentsForTracking(filters?: {
  clienteId?: string;
  typeId?: number;
  statusId?: number;
  startDate?: string;
  endDate?: string;
  assignedFsrId?: string;
  folio?: string;
}) {
  try {
    await requirePermission("tracking:read");

    const where: Prisma.IncidentWhereInput = {
      active: true,
    };

    if (filters?.clienteId) {
      where.clienteId = filters.clienteId;
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

    const incidentSelect = {
      id: true,
      title: true,
      description: true,
      reportedAt: true,
      resolvedAt: true,
      lineId: true,
      equipmentId: true,
      cliente: {
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
          createdAt: true,
          assignees: {
            where: { active: true },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  roleId: true,
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

    return { data: incidents, totalCount };
  } catch (error) {
    rethrowBusinessError(error);
    console.error("Error fetching incidents for tracking:", error);
    throw new Error("Failed to fetch incidents");
  }
}

/**
 * Every active FSR, each carrying the Clientes they are assigned to.
 *
 * The Cliente link is a hint, not a filter: the UI surfaces it as a badge so an
 * operator can tell at a glance who usually covers that center, but anyone can
 * be assigned anywhere. This replaced a per-Cliente query that the tracking
 * page called once per Cliente and then de-duplicated.
 */
export async function getTrackingFsrs() {
  try {
    await requirePermission("tracking:read");

    const users = await prisma.user.findMany({
      where: { active: true, role: { name: "FSR" } },
      select: {
        id: true,
        name: true,
        email: true,
        clienteAssignments: {
          where: { active: true },
          select: { clienteId: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      clienteIds: u.clienteAssignments.map((a) => a.clienteId),
    }));
  } catch (error) {
    rethrowBusinessError(error);
    console.error("Error fetching FSRs for tracking:", error);
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
      await enableFsrsOnIncident(tx, incidentId, [fsrId]);

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
    return { success: true as const };
  } catch (error) {
    rethrowBusinessError(error);
    console.error("Error assigning FSR to incident:", error);
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
      select: { incidentId: true },
    });
    if (!assignment) {
      return rejected("La asignación ya no existe.");
    }
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

      await enableFsrsOnIncident(tx, assignment.incidentId, toAdd);

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
    // `as const` so the caller can discriminate this from `rejected()`.
    return { success: true as const, assignment: updatedAssignment };
  } catch (error) {
    rethrowBusinessError(error);
    console.error("Error updating assignment assignees:", error);
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
  try {
    await requirePermission("tracking:update");

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
        statusId: data.statusId,
        lineId: data.lineId || null,
        equipmentId: data.equipmentId || null,
      },
    });

    revalidatePath("/admin/tracking");
    return { success: true };
  } catch (error) {
    rethrowBusinessError(error);
    console.error("Error updating incident:", error);
    throw new Error("Failed to update incident");
  }
}

export async function updateAssignmentDetails(
  assignmentId: string,
  data: {
    statusId?: number | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  },
) {
  try {
    await requirePermission("tracking:update");

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        statusId: data.statusId || null,
        startedAt: data.startedAt ? new Date(data.startedAt) : null,
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
      },
    });

    revalidatePath("/admin/tracking");
    return { success: true };
  } catch (error) {
    rethrowBusinessError(error);
    console.error("Error updating assignment:", error);
    throw new Error("Failed to update assignment");
  }
}
