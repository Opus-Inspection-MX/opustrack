"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { getClienteWhereClause } from "@/lib/auth/filters";
import { whereHasPermission, whereHasRole } from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  getOperationsAudience,
  notifyAssignmentAssigned,
  notifyAssignmentCompleted,
  notifyAssignmentReopened,
  notifyAssignmentUpdated,
  notifyIncidentClosed,
} from "@/lib/notifications";
import {
  ASSIGNMENT_STATE,
  type AssignmentState,
  assertAssignmentPreconditions,
  assertAssignmentTransition,
  isAssignmentState,
  syncIncidentState,
} from "@/lib/state-machine";
import { isFsrUnavailable } from "@/lib/utils/availability";
import { businessRule, guarded } from "./result";

export type AssignmentFormData = {
  incidentId: number;
  assigneeIds: string[];
  statusId?: number | null;
  notes?: string;
  odtFolio?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  scheduledDate?: Date | null;
};

const assigneesInclude = {
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
} as const;

/**
 * Validate that the given users are active FSRs. FSR assignment is independent
 * of the incident's Cliente and no longer requires per-incident enablement.
 */
async function assertAssigneesAreFsrs(userIds: string[]) {
  if (userIds.length === 0) return;
  const fsrs = await prisma.user.findMany({
    where: { id: { in: userIds }, active: true, ...whereHasRole("FSR") },
    select: { id: true },
  });
  if (fsrs.length !== new Set(userIds).size) {
    businessRule("Uno o más FSR no existen o no tienen rol FSR");
  }
}

/**
 * Get all assignments
 * Filtered by user's Cliente (except ADMINISTRADOR who sees all)
 */
export async function getAssignments() {
  const user = await requirePermission("assignments:read");
  const clienteFilter = getClienteWhereClause(user);

  const assignments = await prisma.assignment.findMany({
    where: {
      active: true,
      incident: { ...clienteFilter },
    },
    include: {
      incident: {
        include: {
          type: true,
          status: true,
          cliente: true,
        },
      },
      ...assigneesInclude,
      assignmentActivities: {
        where: { active: true },
        orderBy: { performedAt: "desc" },
      },
      _count: {
        select: {
          assignmentActivities: true,
          workParts: true,
        },
      },
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return assignments;
}

/**
 * Get single assignment by ID
 */
export async function getAssignmentById(id: string) {
  const user = await requirePermission("assignments:read");

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      incident: {
        include: {
          type: true,
          status: true,
          cliente: true,
          reportedBy: true,
        },
      },
      ...assigneesInclude,
      assignmentActivities: {
        where: { active: true },
        include: {
          workParts: {
            include: {
              part: true,
            },
          },
        },
        orderBy: { performedAt: "desc" },
      },
      workParts: {
        where: { active: true },
        include: {
          part: true,
        },
      },
      attachments: {
        where: { active: true },
      },
      status: true,
    },
  });

  if (assignment?.incident?.clienteId) {
    const { assertClienteAccess } = await import("@/lib/auth/filters");
    assertClienteAccess(user, assignment.incident.clienteId);
  }

  return assignment;
}

/**
 * Resolve an AssignmentStatus id by name within a transaction (or default client).
 * Throws if the catalog row is missing — state-machine code requires the seed
 * to be present.
 */
async function resolveAssignmentStatusId(
  client:
    | typeof prisma
    | Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  name: AssignmentState,
): Promise<number> {
  const row = await client.assignmentStatus.findUnique({
    where: { name },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`AssignmentStatus '${name}' no existe en el catálogo`);
  }
  return row.id;
}

/**
 * Create new assignment.
 *
 * Initial state: PENDIENTE_DE_ASIGNACION if no assignees, ASIGNADO otherwise.
 * Caller-provided statusId is ignored — the state machine owns it.
 */
export async function createAssignment(data: AssignmentFormData) {
  const user = await requirePermission("assignments:create");

  return guarded(async () => {
    const uniqueAssignees = Array.from(new Set(data.assigneeIds));

    await assertAssigneesAreFsrs(uniqueAssignees);

    // Availability check: only when scheduledDate is provided and there are assignees.
    if (data.scheduledDate != null && uniqueAssignees.length > 0) {
      for (const userId of uniqueAssignees) {
        const unavailable = await isFsrUnavailable(userId, data.scheduledDate);
        if (unavailable) {
          const fsrRecord = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          const label = fsrRecord?.name ?? userId;
          businessRule(
            `El técnico ${label} no está disponible en la fecha programada (día festivo o vacaciones aprobadas).`,
          );
        }
      }
    }

    const initialState =
      uniqueAssignees.length === 0
        ? ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION
        : ASSIGNMENT_STATE.ASIGNADO;

    const assignment = await prisma.$transaction(async (tx) => {
      const statusId = await resolveAssignmentStatusId(tx, initialState);
      const created = await tx.assignment.create({
        data: {
          incidentId: data.incidentId,
          statusId,
          notes: data.notes || null,
          odtFolio: data.odtFolio?.trim() || null,
          scheduledDate: data.scheduledDate ?? null,
          assignedAt: uniqueAssignees.length > 0 ? new Date() : null,
          assignees: {
            create: uniqueAssignees.map((userId) => ({ userId })),
          },
        },
        include: {
          incident: true,
          ...assigneesInclude,
          status: true,
        },
      });
      await syncIncidentState(data.incidentId, tx);
      return created;
    });

    // POST-tx notification: new FSRs receive ASSIGNMENT_ASSIGNED (actor excluded by emit).
    if (uniqueAssignees.length > 0) {
      await notifyAssignmentAssigned(
        assignment.id,
        assignment.incident?.title,
        uniqueAssignees,
        user.id,
      );
    }

    revalidatePath("/admin/assignments");
    revalidatePath("/fsr/assignments");
    revalidatePath(`/admin/incidents/${data.incidentId}`);
    return { data: assignment };
  });
}

/**
 * Update existing assignment
 */
export async function updateAssignment(id: string, data: AssignmentFormData) {
  const user = await requirePermission("assignments:update");

  return guarded(async () => {
    const uniqueAssignees = Array.from(new Set(data.assigneeIds));

    const existingAssignment = await prisma.assignment.findUnique({
      where: { id },
      select: { incidentId: true, scheduledDate: true },
    });
    if (!existingAssignment) throw new Error("Assignment not found");
    await assertAssigneesAreFsrs(uniqueAssignees);

    // Resolve effective scheduledDate (new value ?? existing value) for the block check.
    const effectiveScheduledDate =
      data.scheduledDate !== undefined
        ? data.scheduledDate
        : existingAssignment.scheduledDate;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.assignmentAssignee.findMany({
        where: { assignmentId: id, active: true },
        select: { userId: true },
      });
      const existingIds = new Set(existing.map((a) => a.userId));
      const newIds = new Set(uniqueAssignees);

      const toAdd = uniqueAssignees.filter((u) => !existingIds.has(u));
      const toRemove = [...existingIds].filter((u) => !newIds.has(u));

      // Availability check (RF-704). Two cases must be covered:
      //   - newly added FSRs, against the effective scheduled date;
      //   - ALL assignees when the scheduled date itself moves, otherwise moving
      //     an assignment onto a holiday or an approved vacation would slip
      //     through because `toAdd` is empty.
      const scheduledDateChanged =
        data.scheduledDate !== undefined &&
        effectiveScheduledDate?.getTime() !==
          existingAssignment.scheduledDate?.getTime();

      const toCheck = scheduledDateChanged
        ? Array.from(new Set([...uniqueAssignees, ...existingIds]))
        : toAdd;

      if (effectiveScheduledDate != null && toCheck.length > 0) {
        for (const userId of toCheck) {
          const unavailable = await isFsrUnavailable(
            userId,
            effectiveScheduledDate,
          );
          if (unavailable) {
            const fsrRecord = await tx.user.findUnique({
              where: { id: userId },
              select: { name: true },
            });
            const label = fsrRecord?.name ?? userId;
            businessRule(
              `El técnico ${label} no está disponible en la fecha programada (día festivo o vacaciones aprobadas).`,
            );
          }
        }
      }

      const isReassignment = toAdd.length > 0 || toRemove.length > 0;

      if (toRemove.length > 0) {
        await tx.assignmentAssignee.updateMany({
          where: {
            assignmentId: id,
            userId: { in: toRemove },
            active: true,
          },
          data: { active: false },
        });
      }

      for (const userId of toAdd) {
        await tx.assignmentAssignee.upsert({
          where: { assignmentId_userId: { assignmentId: id, userId } },
          create: { assignmentId: id, userId, active: true },
          update: { active: true, assignedAt: new Date() },
        });
      }

      // Auto-transition status based on assignee changes (state machine).
      let nextStatusId: number | undefined;
      if (isReassignment) {
        const current = await tx.assignment.findUnique({
          where: { id },
          select: { status: { select: { name: true } } },
        });
        const currentName = current?.status?.name;
        const totalActive = existingIds.size + toAdd.length - toRemove.length;
        if (totalActive === 0) {
          // Last assignee removed → revert to PENDIENTE_DE_ASIGNACION (only if
          // the assignment hasn't progressed past ASIGNADO).
          if (
            currentName === ASSIGNMENT_STATE.ASIGNADO ||
            currentName === ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION
          ) {
            nextStatusId = await resolveAssignmentStatusId(
              tx,
              ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
            );
          }
        } else if (currentName === ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION) {
          nextStatusId = await resolveAssignmentStatusId(
            tx,
            ASSIGNMENT_STATE.ASIGNADO,
          );
        }
      }

      const assignment = await tx.assignment.update({
        where: { id },
        data: {
          notes: data.notes || null,
          odtFolio:
            data.odtFolio === undefined
              ? undefined
              : data.odtFolio?.trim() || null,
          // scheduledDate: undefined means "don't change"; null means "clear it".
          ...(data.scheduledDate !== undefined && {
            scheduledDate: data.scheduledDate,
          }),
          ...(nextStatusId !== undefined && { statusId: nextStatusId }),
          ...(isReassignment && {
            assignedAt: new Date(),
            // Reassignment resets "seen" — the new FSR must acknowledge again.
            seenAt: null,
            seenById: null,
          }),
        },
        include: {
          incident: true,
          ...assigneesInclude,
          status: true,
        },
      });

      await syncIncidentState(assignment.incidentId, tx);

      // preExisting: active assignees that were already assigned and are NOT newly added.
      // Disjoint from toAdd so no FSR gets both ASSIGNMENT_ASSIGNED and ASSIGNMENT_UPDATED.
      const toRemoveSet = new Set(toRemove);
      const toAddSet = new Set(toAdd);
      const preExisting = [...existingIds].filter(
        (u) => !toRemoveSet.has(u) && !toAddSet.has(u),
      );

      return { assignment, toAdd, preExisting };
    });

    // POST-tx notifications (disjoint sets):
    // - New FSRs → ASSIGNMENT_ASSIGNED
    // - Pre-existing active FSRs → ASSIGNMENT_UPDATED
    if (result.toAdd.length > 0) {
      await notifyAssignmentAssigned(
        id,
        result.assignment.incident?.title,
        result.toAdd,
        user.id,
      );
    }
    if (result.preExisting.length > 0) {
      await notifyAssignmentUpdated(
        id,
        result.assignment.incident?.title,
        result.preExisting,
        user.id,
      );
    }

    revalidatePath("/admin/assignments");
    revalidatePath(`/admin/assignments/${id}`);
    revalidatePath(`/admin/incidents/${result.assignment.incidentId}`);
    revalidatePath("/fsr/assignments");
    revalidatePath(`/fsr/assignments/${id}`);
    return { data: result.assignment };
  });
}

/**
 * Ensure the given FSRs have a real, visible Assignment on this incident.
 *
 * Incident-level "assign FSR" UI (quick-edit popover, incident edit form,
 * bulk actions) only used to grant IncidentAssignee eligibility and notify —
 * without ever creating the Assignment the FSR actually sees in
 * /fsr/assignments. Callers pass the newly-added FSR ids here right after
 * granting eligibility so the notification's promise is backed by real work.
 *
 * Reuses the incident's current active Assignment if one exists (adding
 * assignees and reviving it to ASIGNADO if it was PENDIENTE_DE_ASIGNACION),
 * or creates one. No-op if fsrIds is empty.
 */
export async function ensureFsrsAssignedToIncident(
  incidentId: number,
  fsrIds: string[],
  actorId: string,
): Promise<void> {
  if (fsrIds.length === 0) return;

  const result = await prisma.$transaction(async (tx) => {
    const existingAssignment = await tx.assignment.findFirst({
      where: { incidentId, active: true },
      select: { id: true, status: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    let assignmentId: string;
    let toAdd: string[];

    if (existingAssignment) {
      assignmentId = existingAssignment.id;
      const existingAssignees = await tx.assignmentAssignee.findMany({
        where: { assignmentId, active: true },
        select: { userId: true },
      });
      const existingIds = new Set(existingAssignees.map((a) => a.userId));
      toAdd = fsrIds.filter((u) => !existingIds.has(u));

      for (const userId of toAdd) {
        await tx.assignmentAssignee.upsert({
          where: { assignmentId_userId: { assignmentId, userId } },
          create: { assignmentId, userId, active: true },
          update: { active: true, assignedAt: new Date() },
        });
      }

      if (
        toAdd.length > 0 &&
        existingAssignment.status?.name ===
          ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION
      ) {
        const statusId = await resolveAssignmentStatusId(
          tx,
          ASSIGNMENT_STATE.ASIGNADO,
        );
        await tx.assignment.update({
          where: { id: assignmentId },
          data: { statusId, assignedAt: new Date() },
        });
      }
    } else {
      const statusId = await resolveAssignmentStatusId(
        tx,
        ASSIGNMENT_STATE.ASIGNADO,
      );
      const created = await tx.assignment.create({
        data: {
          incidentId,
          statusId,
          assignedAt: new Date(),
          assignees: { create: fsrIds.map((userId) => ({ userId })) },
        },
        select: { id: true },
      });
      assignmentId = created.id;
      toAdd = fsrIds;
    }

    await syncIncidentState(incidentId, tx);

    return { assignmentId, toAdd };
  });

  if (result.toAdd.length === 0) return;

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { title: true },
  });

  await notifyAssignmentAssigned(
    result.assignmentId,
    incident?.title,
    result.toAdd,
    actorId,
  );

  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${result.assignmentId}`);
  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${result.assignmentId}`);
  revalidatePath(`/admin/incidents/${incidentId}`);
}

/**
 * Delete assignment (soft delete)
 */
export async function deleteAssignment(id: string) {
  await requirePermission("assignments:delete");

  return guarded(async () => {
    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.findUnique({
        where: { id },
        select: {
          incidentId: true,
          _count: {
            select: {
              workParts: { where: { active: true } },
              assignmentActivities: { where: { active: true } },
              attachments: { where: { active: true } },
            },
          },
        },
      });

      if (!assignment) {
        throw new Error("Assignment not found");
      }

      const hasActiveParts = assignment._count.workParts > 0;
      const hasActiveActivities = assignment._count.assignmentActivities > 0;
      const hasActiveAttachments = assignment._count.attachments > 0;

      if (hasActiveParts || hasActiveActivities || hasActiveAttachments) {
        const issues = [];
        if (hasActiveParts)
          issues.push(`${assignment._count.workParts} parte(s)`);
        if (hasActiveActivities)
          issues.push(
            `${assignment._count.assignmentActivities} actividad(es)`,
          );
        if (hasActiveAttachments)
          issues.push(`${assignment._count.attachments} archivo(s)`);
        businessRule(
          `No se puede eliminar. La asignación tiene: ${issues.join(", ")} activos.`,
        );
      }

      await tx.assignment.update({
        where: { id },
        data: { active: false },
      });

      return { incidentId: assignment.incidentId };
    });

    revalidatePath("/admin/assignments");
    revalidatePath(`/admin/incidents/${result.incidentId}`);
    redirect("/admin/assignments");
  });
}

// ============================================================================
// State machine actions
// ============================================================================

function revalidateAssignmentPaths(assignmentId: string, incidentId: number) {
  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${assignmentId}`);
  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${assignmentId}`);
  revalidatePath(`/admin/incidents/${incidentId}`);
  revalidatePath("/admin/incidents");
  revalidatePath("/client/incidents");
  revalidatePath("/admin/tracking");
}

async function loadAssignmentForTransition(
  client:
    | typeof prisma
    | Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
) {
  const assignment = await client.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      incidentId: true,
      status: { select: { name: true } },
      assignees: { where: { active: true }, select: { userId: true } },
    },
  });
  if (!assignment) throw new Error("Asignación no encontrada");
  if (!assignment.status?.name || !isAssignmentState(assignment.status.name)) {
    throw new Error(
      `Estado actual de la asignación inválido: '${assignment.status?.name ?? "(ninguno)"}'`,
    );
  }
  return assignment;
}

async function ensureCallerIsAssigneeOrAdmin(
  callerId: string,
  assignees: { userId: string }[],
): Promise<boolean> {
  const isAssignee = assignees.some((a) => a.userId === callerId);
  if (isAssignee) return true;
  // Overriding someone else's assignment is a capability, not a role name: an
  // operations admin needs it, a vacation admin must not have it.
  const override = await prisma.user.count({
    where: { id: callerId, ...whereHasPermission("assignments:manage-all") },
  });
  if (override > 0) return true;
  businessRule(
    "Solo un FSR asignado o un administrador puede ejecutar esta acción",
  );
}

/**
 * Throws if the parent incident is in a terminal state (CERRADO/CANCELADA).
 * Use to block FSR mutations on assignments whose incident is no longer editable.
 */
async function assertIncidentEditable(
  client:
    | typeof prisma
    | Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  incidentId: number,
): Promise<void> {
  const incident = await client.incident.findUnique({
    where: { id: incidentId },
    select: { status: { select: { name: true } } },
  });
  const name = incident?.status?.name;
  if (name === "CERRADO" || name === "CANCELADA") {
    businessRule(
      name === "CANCELADA"
        ? "La incidencia está cancelada. No se pueden hacer cambios."
        : "La incidencia está cerrada. No se pueden hacer cambios.",
    );
  }
}

/**
 * Mark assignment as "seen" (replaces the legacy unlock flow).
 * Sets seenAt + seenById and transitions status to VISTO.
 */
export async function markAssignmentSeen(id: string) {
  const user = await requirePermission("assignments:update");

  return guarded(async () => {
    const result = await prisma.$transaction(async (tx) => {
      const current = await loadAssignmentForTransition(tx, id);
      await ensureCallerIsAssigneeOrAdmin(user.id, current.assignees);
      await assertIncidentEditable(tx, current.incidentId);
      const from = current.status?.name as AssignmentState;
      if (from === ASSIGNMENT_STATE.VISTO) {
        return { assignment: null, incidentId: current.incidentId, noop: true };
      }
      assertAssignmentTransition(from, ASSIGNMENT_STATE.VISTO);
      const statusId = await resolveAssignmentStatusId(
        tx,
        ASSIGNMENT_STATE.VISTO,
      );
      const updated = await tx.assignment.update({
        where: { id },
        data: {
          statusId,
          seenAt: new Date(),
          seenById: user.id,
        },
        include: { incident: true, ...assigneesInclude, status: true },
      });
      await syncIncidentState(current.incidentId, tx);
      return {
        assignment: updated,
        incidentId: current.incidentId,
        noop: false,
      };
    });

    if (!result.noop && result.assignment) {
      const assigneeIds = result.assignment.assignees.map((a) => a.userId);
      await notifyAssignmentUpdated(
        id,
        result.assignment.incident?.title,
        assigneeIds,
        user.id,
      );
    }

    revalidateAssignmentPaths(id, result.incidentId);
    return { data: result.assignment, noop: result.noop };
  });
}

/**
 * Start on-site work — transitions VISTO → INICIADO.
 *
 * Required FormData fields:
 *  - assignmentId: string
 *  - latitude: number
 *  - longitude: number
 *  - address: string (optional)
 */
export async function startAssignmentWork(formData: FormData) {
  const user = await requirePermission("assignments:update");

  return guarded(async () => {
    const id = formData.get("assignmentId");
    const lat = Number(formData.get("latitude"));
    const lng = Number(formData.get("longitude"));
    const address = formData.get("address");

    if (typeof id !== "string" || id.trim() === "") {
      throw new Error("assignmentId requerido");
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      businessRule("Ubicación GPS inválida");
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await loadAssignmentForTransition(tx, id);
      await ensureCallerIsAssigneeOrAdmin(user.id, current.assignees);
      await assertIncidentEditable(tx, current.incidentId);
      const from = current.status?.name as AssignmentState;
      assertAssignmentTransition(from, ASSIGNMENT_STATE.INICIADO);

      const now = new Date();
      assertAssignmentPreconditions(ASSIGNMENT_STATE.INICIADO, {
        startedAt: now,
        finishedAt: null,
        startLatitude: lat,
        startLongitude: lng,
        endLatitude: null,
        endLongitude: null,
        attachmentCount: 0,
        odtFolio: null,
      });

      const statusId = await resolveAssignmentStatusId(
        tx,
        ASSIGNMENT_STATE.INICIADO,
      );
      const updated = await tx.assignment.update({
        where: { id },
        data: {
          statusId,
          startedAt: now,
          startLatitude: lat,
          startLongitude: lng,
          startAddress:
            typeof address === "string" && address.trim() !== ""
              ? address.trim()
              : null,
        },
        include: { incident: true, ...assigneesInclude, status: true },
      });
      await syncIncidentState(current.incidentId, tx);
      return { assignment: updated, incidentId: current.incidentId };
    });

    const assigneeIds = result.assignment.assignees.map((a) => a.userId);
    await notifyAssignmentUpdated(
      id,
      result.assignment.incident?.title,
      assigneeIds,
      user.id,
    );

    revalidateAssignmentPaths(id, result.incidentId);
    return { data: result.assignment };
  });
}

/**
 * INICIADO → EN_PROGRESO (paused on-site / work continues but not yet closed).
 */
export async function pauseAssignment(id: string) {
  const user = await requirePermission("assignments:update");
  const result = await prisma.$transaction(async (tx) => {
    const current = await loadAssignmentForTransition(tx, id);
    await ensureCallerIsAssigneeOrAdmin(user.id, current.assignees);
    await assertIncidentEditable(tx, current.incidentId);
    const from = current.status?.name as AssignmentState;
    assertAssignmentTransition(from, ASSIGNMENT_STATE.EN_PROGRESO);
    const statusId = await resolveAssignmentStatusId(
      tx,
      ASSIGNMENT_STATE.EN_PROGRESO,
    );
    const updated = await tx.assignment.update({
      where: { id },
      data: { statusId },
      include: { incident: true, ...assigneesInclude, status: true },
    });
    await syncIncidentState(current.incidentId, tx);
    return { assignment: updated, incidentId: current.incidentId };
  });

  const assigneeIds = result.assignment.assignees.map((a) => a.userId);
  await notifyAssignmentUpdated(
    id,
    result.assignment.incident?.title,
    assigneeIds,
    user.id,
  );

  revalidateAssignmentPaths(id, result.incidentId);
  return { success: true, data: result.assignment };
}

/**
 * EN_PROGRESO → INICIADO (resume on-site work).
 */
export async function resumeAssignment(id: string) {
  const user = await requirePermission("assignments:update");
  const result = await prisma.$transaction(async (tx) => {
    const current = await loadAssignmentForTransition(tx, id);
    await ensureCallerIsAssigneeOrAdmin(user.id, current.assignees);
    await assertIncidentEditable(tx, current.incidentId);
    const from = current.status?.name as AssignmentState;
    assertAssignmentTransition(from, ASSIGNMENT_STATE.INICIADO);
    const statusId = await resolveAssignmentStatusId(
      tx,
      ASSIGNMENT_STATE.INICIADO,
    );
    const updated = await tx.assignment.update({
      where: { id },
      data: { statusId },
      include: { incident: true, ...assigneesInclude, status: true },
    });
    await syncIncidentState(current.incidentId, tx);
    return { assignment: updated, incidentId: current.incidentId };
  });

  const assigneeIds = result.assignment.assignees.map((a) => a.userId);
  await notifyAssignmentUpdated(
    id,
    result.assignment.incident?.title,
    assigneeIds,
    user.id,
  );

  revalidateAssignmentPaths(id, result.incidentId);
  return { success: true, data: result.assignment };
}

/**
 * Close assignment — transitions INICIADO/EN_PROGRESO → CERRADO.
 * Requires: end GPS + at least one active attachment (evidence) + ODT folio.
 *
 * Required FormData fields:
 *  - assignmentId: string
 *  - latitude: number
 *  - longitude: number
 *  - address: string (optional)
 *  - notes: string (optional)
 */
export async function closeAssignment(formData: FormData) {
  const user = await requirePermission("assignments:complete");

  return guarded(async () => {
    const id = formData.get("assignmentId");
    const lat = Number(formData.get("latitude"));
    const lng = Number(formData.get("longitude"));
    const address = formData.get("address");
    const notes = formData.get("notes");

    if (typeof id !== "string" || id.trim() === "") {
      throw new Error("assignmentId requerido");
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      businessRule("Ubicación GPS final inválida");
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await loadAssignmentForTransition(tx, id);
      await ensureCallerIsAssigneeOrAdmin(user.id, current.assignees);
      await assertIncidentEditable(tx, current.incidentId);
      const from = current.status?.name as AssignmentState;
      assertAssignmentTransition(from, ASSIGNMENT_STATE.CERRADO);

      const attachmentCount = await tx.assignmentAttachment.count({
        where: { assignmentId: id, active: true },
      });
      const odtRow = await tx.assignment.findUnique({
        where: { id },
        select: { odtFolio: true },
      });
      const now = new Date();
      assertAssignmentPreconditions(ASSIGNMENT_STATE.CERRADO, {
        startedAt: null,
        finishedAt: now,
        startLatitude: null,
        startLongitude: null,
        endLatitude: lat,
        endLongitude: lng,
        attachmentCount,
        odtFolio: odtRow?.odtFolio ?? null,
      });

      const statusId = await resolveAssignmentStatusId(
        tx,
        ASSIGNMENT_STATE.CERRADO,
      );
      const updated = await tx.assignment.update({
        where: { id },
        data: {
          statusId,
          finishedAt: now,
          endLatitude: lat,
          endLongitude: lng,
          endAddress:
            typeof address === "string" && address.trim() !== ""
              ? address.trim()
              : null,
          notes:
            typeof notes === "string" && notes.trim() !== ""
              ? notes.trim()
              : undefined,
        },
        include: { incident: true, ...assigneesInclude, status: true },
      });
      const { before: incidentBefore, after: incidentAfter } =
        await syncIncidentState(current.incidentId, tx);
      return {
        assignment: updated,
        incidentId: current.incidentId,
        incidentBefore,
        incidentAfter,
      };
    });

    const assigneeIds = result.assignment.assignees.map((a) => a.userId);
    const adminIds = await getOperationsAudience();
    const completedRecipients = [...assigneeIds, ...adminIds];
    await notifyAssignmentCompleted(
      id,
      result.assignment.incident?.title,
      completedRecipients,
      user.id,
    );

    // POST-tx: fire INCIDENT_CLOSED only on a real CERRADO transition (RF-467).
    if (
      result.incidentBefore !== "CERRADO" &&
      result.incidentAfter === "CERRADO"
    ) {
      const incidentData = await prisma.incident.findUnique({
        where: { id: result.incidentId },
        select: { reportedById: true, title: true },
      });
      await notifyIncidentClosed(
        result.incidentId,
        incidentData?.title,
        incidentData?.reportedById ?? null,
        user.id,
      );
    }

    revalidateAssignmentPaths(id, result.incidentId);
    return { data: result.assignment };
  });
}

/**
 * Reopen a closed assignment back to EN_PROGRESO. Admins only.
 */
export async function reopenAssignment(id: string) {
  const user = await requirePermission("assignments:reopen");
  const result = await prisma.$transaction(async (tx) => {
    const current = await loadAssignmentForTransition(tx, id);
    const from = current.status?.name as AssignmentState;
    assertAssignmentTransition(from, ASSIGNMENT_STATE.EN_PROGRESO);
    const statusId = await resolveAssignmentStatusId(
      tx,
      ASSIGNMENT_STATE.EN_PROGRESO,
    );
    const updated = await tx.assignment.update({
      where: { id },
      data: {
        statusId,
        finishedAt: null,
      },
      include: { incident: true, ...assigneesInclude, status: true },
    });
    await syncIncidentState(current.incidentId, tx);
    return { assignment: updated, incidentId: current.incidentId };
  });

  const assigneeIds = result.assignment.assignees.map((a) => a.userId);
  await notifyAssignmentReopened(
    id,
    result.assignment.incident?.title,
    assigneeIds,
    user.id,
  );

  revalidateAssignmentPaths(id, result.incidentId);
  return { success: true, data: result.assignment };
}

/**
 * Get assignments assigned to current user (FSR)
 */
export async function getMyAssignments() {
  const user = await requirePermission("assignments:read");

  const assignments = await prisma.assignment.findMany({
    where: {
      assignees: { some: { userId: user.id, active: true } },
      active: true,
    },
    include: {
      incident: {
        include: {
          type: true,
          status: true,
          cliente: true,
        },
      },
      ...assigneesInclude,
      _count: {
        select: {
          assignmentActivities: true,
          workParts: true,
        },
      },
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return assignments;
}

/**
 * Get form options for assignments
 */
export async function getAssignmentFormOptions() {
  await requirePermission("assignments:read");

  const [incidents, users, assignmentStatuses] = await Promise.all([
    prisma.incident.findMany({
      where: { active: true },
      include: {
        type: true,
        status: true,
        cliente: true,
        assignees: {
          where: { active: true },
          select: { userId: true },
        },
      },
      orderBy: { reportedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { active: true, ...whereHasRole("FSR") },
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
    }),
    prisma.assignmentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const usersWithClienteIds = users.map((user) => ({
    ...user,
    clienteIds: user.clienteAssignments.map((va) => va.clienteId),
  }));

  const incidentsWithAssigneeIds = incidents.map((inc) => ({
    ...inc,
    assigneeIds: inc.assignees.map((a) => a.userId),
  }));

  return {
    incidents: incidentsWithAssigneeIds,
    users: usersWithClienteIds,
    assignmentStatuses,
  };
}

/**
 * Upload attachment for assignment (multipart FormData).
 * Avoids base64 inflation so high-res phone photos don't exceed the Server
 * Actions body limit.
 *
 * Expected FormData fields:
 *  - assignmentId: string (required)
 *  - file: File (required)
 *  - mimetype: string (optional; client-normalized override for File.type)
 *  - description: string (optional)
 */
export async function uploadAssignmentAttachment(formData: FormData) {
  await requirePermission("assignments:update");

  return guarded(async () => {
    const assignmentId = formData.get("assignmentId");
    const file = formData.get("file");
    const mimetypeField = formData.get("mimetype");
    const descriptionField = formData.get("description");

    if (typeof assignmentId !== "string" || assignmentId.trim() === "") {
      throw new Error("assignmentId requerido");
    }
    if (!(file instanceof File)) {
      businessRule("Archivo inválido");
    }

    const mimetype =
      (typeof mimetypeField === "string" && mimetypeField.trim()) ||
      file.type ||
      "application/octet-stream";

    const { assertAllowedUpload, uploadFileFromBuffer } = await import(
      "@/lib/storage/file-storage"
    );
    assertAllowedUpload(mimetype, file.size);

    // Verify the assignment exists and the caller can reach its Cliente
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { incidentId: true, incident: { select: { clienteId: true } } },
    });
    if (!assignment) {
      throw new Error("Asignación no encontrada");
    }
    await assertIncidentEditable(prisma, assignment.incidentId);
    if (assignment.incident?.clienteId) {
      const { assertClienteAccess } = await import("@/lib/auth/filters");
      const { requireAuth } = await import("@/lib/auth/auth");
      const user = await requireAuth();
      assertClienteAccess(user, assignment.incident.clienteId);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadResult = await uploadFileFromBuffer(
      file.name,
      buffer,
      mimetype,
      {
        subfolder: "assignments",
      },
    );

    const description =
      typeof descriptionField === "string" && descriptionField.trim() !== ""
        ? descriptionField.trim()
        : null;

    const attachment = await prisma.assignmentAttachment.create({
      data: {
        assignmentId,
        filename: uploadResult.filename,
        filepath: uploadResult.url,
        mimetype: uploadResult.mimetype,
        size: uploadResult.size,
        description,
        provider: uploadResult.provider,
      },
    });

    revalidatePath(`/admin/assignments/${assignmentId}`);
    revalidatePath(`/fsr/assignments/${assignmentId}`);

    return { data: attachment };
  });
}

/**
 * Delete assignment attachment
 */
export async function deleteAssignmentAttachment(id: string) {
  await requirePermission("assignments:update");

  return guarded(async () => {
    const attachment = await prisma.assignmentAttachment.findUnique({
      where: { id },
      include: { assignment: { select: { incidentId: true } } },
    });

    if (!attachment) {
      throw new Error("Attachment not found");
    }

    await assertIncidentEditable(prisma, attachment.assignment.incidentId);

    await prisma.assignmentAttachment.update({
      where: { id },
      data: { active: false },
    });

    try {
      const { deleteFile } = await import("@/lib/storage/file-storage");
      await deleteFile(
        attachment.filepath,
        attachment.provider as "vercel-blob" | "filesystem",
      );
    } catch (error) {
      console.error("Error deleting file:", error);
    }

    revalidatePath(`/admin/assignments/${attachment.assignmentId}`);
    revalidatePath(`/fsr/assignments/${attachment.assignmentId}`);

    return {};
  });
}

/**
 * RF-010: Update only the ODT folio of an assignment.
 * Captured from the activities module by FSRs.
 */
export async function updateAssignmentOdtFolio(
  id: string,
  odtFolio: string | null,
) {
  const user = await requirePermission("assignments:update");

  return guarded(async () => {
    const trimmed = odtFolio?.trim() || null;

    const existing = await prisma.assignment.findUnique({
      where: { id },
      select: { incidentId: true },
    });
    if (!existing) throw new Error("Asignación no encontrada");
    await assertIncidentEditable(prisma, existing.incidentId);

    const assignment = await prisma.assignment.update({
      where: { id },
      data: { odtFolio: trimmed },
      select: {
        id: true,
        odtFolio: true,
        incidentId: true,
        incident: { select: { title: true } },
        assignees: { where: { active: true }, select: { userId: true } },
      },
    });

    const assigneeIds = assignment.assignees.map((a) => a.userId);
    await notifyAssignmentUpdated(
      id,
      assignment.incident?.title,
      assigneeIds,
      user.id,
    );

    revalidatePath(`/admin/assignments/${id}`);
    revalidatePath(`/fsr/assignments/${id}`);
    revalidatePath(`/admin/incidents/${assignment.incidentId}`);

    return { data: assignment };
  });
}

/**
 * Generic status update for admin overrides — guarded by the state machine.
 * Will reject any transition not allowed by assignment-machine.ts.
 * Does NOT capture GPS — for transitions that require GPS (INICIADO, CERRADO)
 * use startAssignmentWork() and closeAssignment() instead.
 */
export async function updateAssignmentStatus(id: string, statusId: number) {
  const user = await requirePermission("assignments:update");

  return guarded(async () => {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.assignmentStatus.findUnique({
        where: { id: statusId },
        select: { name: true },
      });
      if (!target?.name || !isAssignmentState(target.name)) {
        throw new Error(
          `AssignmentStatus '${target?.name ?? statusId}' inválido`,
        );
      }
      const current = await loadAssignmentForTransition(tx, id);
      const from = current.status?.name as AssignmentState;
      const to = target.name as AssignmentState;
      assertAssignmentTransition(from, to);

      // For state-machine-managed transitions that require GPS/timestamps,
      // bail out early to force callers to use the dedicated actions.
      if (to === ASSIGNMENT_STATE.INICIADO || to === ASSIGNMENT_STATE.CERRADO) {
        throw new Error(
          `Para transicionar a ${to} usa la acción dedicada (captura GPS requerida)`,
        );
      }

      const updated = await tx.assignment.update({
        where: { id },
        data: { statusId },
        include: { incident: true, ...assigneesInclude, status: true },
      });
      await syncIncidentState(current.incidentId, tx);
      return { assignment: updated, incidentId: current.incidentId };
    });

    const assigneeIds = result.assignment.assignees.map((a) => a.userId);
    await notifyAssignmentUpdated(
      id,
      result.assignment.incident?.title,
      assigneeIds,
      user.id,
    );

    revalidateAssignmentPaths(id, result.incidentId);
    return { data: result.assignment };
  });
}
