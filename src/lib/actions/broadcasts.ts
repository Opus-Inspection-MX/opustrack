"use server";

import { BroadcastStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { SCOPE_ALL_CLIENTS } from "@/lib/authz/authz";
import { assertCanManageRoles } from "@/lib/authz/role-assignment";
import { whereHasPermission, whereHasRoleId } from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";
import { broadcastAudience } from "@/lib/notifications/audiences";
import { dispatchBroadcast } from "@/lib/notifications/broadcast-dispatch";
import { fromDatetimeLocalMX } from "@/lib/utils/datetime";
import { type ActionResult, businessRule, guarded, ok } from "./result";

/**
 * Role-scoped broadcasts (Phase 4).
 *
 * Replaces the legacy `sendBroadcast` (single role, no channels, no
 * scheduling, announcements forced to everyone). Every action here demands
 * `notifications:broadcast`, and every business rule is RETURNED in Spanish
 * (via `businessRule` inside `guarded`) — never thrown.
 *
 * Scope rule (fail closed): a sender reaches the UNION of the
 * `RoleBroadcastTarget` rows of their roles. No rows → nobody. ROOT
 * (`isSuperuser`) bypasses the table and reaches every role. Recipients
 * resolve AT SEND TIME (`dispatchBroadcast`), never at creation.
 */

export type BroadcastKindInput = "SYSTEM" | "ANNOUNCEMENT";

export interface BroadcastFormInput {
  title: string;
  message: string;
  kind: BroadcastKindInput;
  sendInApp: boolean;
  sendEmail: boolean;
  allRoles: boolean;
  roleIds: number[];
  /** Directly-addressed users (Parte C). Union with the role audience. */
  userIds: string[];
  includeSender: boolean;
  /** Immediate send vs. scheduled. */
  sendNow: boolean;
  /** `datetime-local` CDMX wall clock; required when `sendNow` is false. */
  scheduledAtLocal: string | null;
}

export type UpdateBroadcastInput = Omit<BroadcastFormInput, "sendNow">;

/** Sender scope: which roles this sender may address. Never exported. */
async function getSenderBroadcastScope(
  userId: string,
  isSuperuser: boolean,
): Promise<{ allowedRoleIds: number[]; canTargetAll: boolean }> {
  const allRoles = await prisma.role.findMany({
    where: { active: true },
    select: { id: true },
  });
  const allIds = allRoles.map((r) => r.id);
  if (isSuperuser) return { allowedRoleIds: allIds, canTargetAll: true };

  const memberships = await prisma.userRole.findMany({
    where: { userId, active: true },
    select: { roleId: true },
  });
  const myRoleIds = memberships.map((m) => m.roleId);
  if (myRoleIds.length === 0)
    return { allowedRoleIds: [], canTargetAll: false };

  const grants = await prisma.roleBroadcastTarget.findMany({
    where: { sourceRoleId: { in: myRoleIds }, active: true },
    select: { targetRoleId: true },
  });
  const active = new Set(allIds);
  const allowed = [
    ...new Set(
      grants.map((g) => g.targetRoleId).filter((id) => active.has(id)),
    ),
  ];
  return {
    allowedRoleIds: allowed,
    canTargetAll:
      allowed.length > 0 && allIds.every((id) => allowed.includes(id)),
  };
}

/**
 * Direct-user reach (Parte C, decision #2 — the most restrictive of the two
 * rules the system already uses).
 *
 * A sender reaches user U when U holds at least one active role inside
 * `scope.allowedRoleIds`, AND — unless the sender holds `scope:all-clients`
 * — U shares at least one active Client with the sender
 * (`UserClientAssignment`). ROOT (`isSuperuser`) reaches anyone.
 *
 * Fail closed: with no reachable roles there are no reachable users either.
 * Returns the valid ids (deduped); any id outside reach raises `businessRule`.
 * Reach is validated at create/edit time, never at dispatch (decision #3).
 */
async function assertUsersInScope(
  senderId: string,
  scope: { allowedRoleIds: number[]; canTargetAll: boolean },
  userIds: string[],
): Promise<string[]> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return [];
  if (scope.allowedRoleIds.length === 0) {
    businessRule(
      "No puedes difundir a uno o más de los usuarios seleccionados",
    );
  }

  const [superuser, unrestricted] = await Promise.all([
    prisma.userRole.count({
      where: {
        userId: senderId,
        active: true,
        role: { active: true, isSuperuser: true },
      },
    }),
    prisma.user.count({
      where: { id: senderId, ...whereHasPermission(SCOPE_ALL_CLIENTS) },
    }),
  ]);
  if (superuser > 0 || unrestricted > 0) return unique;

  const senderClients = await prisma.userClientAssignment.findMany({
    where: { userId: senderId, active: true },
    select: { clientId: true },
  });
  const shared = senderClients.map((c) => c.clientId);
  if (shared.length === 0) {
    businessRule(
      "No puedes difundir a uno o más de los usuarios seleccionados",
    );
  }

  const reachable = await prisma.user.findMany({
    where: {
      id: { in: unique },
      OR: scope.allowedRoleIds.map((roleId) => whereHasRoleId(roleId)),
      clientAssignments: {
        some: { active: true, clientId: { in: shared } },
      },
    },
    select: { id: true },
  });
  if (reachable.length !== unique.length) {
    businessRule(
      "No puedes difundir a uno o más de los usuarios seleccionados",
    );
  }
  return unique;
}

interface ValidBroadcast {
  title: string;
  message: string;
  kind: BroadcastKindInput;
  sendInApp: boolean;
  sendEmail: boolean;
  allRoles: boolean;
  roleIds: number[];
  userIds: string[];
  includeSender: boolean;
  scheduledAt: Date;
}

/** Shared input validation for create/update. Throws `businessRule`. */
async function assertBroadcastInput(
  input: BroadcastFormInput,
  scope: { allowedRoleIds: number[]; canTargetAll: boolean },
  senderId: string,
): Promise<ValidBroadcast> {
  const title = input.title?.trim();
  const message = input.message?.trim();
  if (!title) businessRule("El título es obligatorio");
  if (!message) businessRule("El mensaje es obligatorio");
  if (input.kind !== "SYSTEM" && input.kind !== "ANNOUNCEMENT") {
    businessRule("Tipo de difusión no válido");
  }
  if (!input.sendInApp && !input.sendEmail) {
    businessRule("Selecciona al menos un canal: notificación o correo");
  }

  const roleIds = [...new Set(input.roleIds ?? [])];
  const userIds = await assertUsersInScope(
    senderId,
    scope,
    input.userIds ?? [],
  );
  if (input.allRoles) {
    if (!scope.canTargetAll) {
      businessRule("No tienes permiso para difundir a todos los roles");
    }
  } else {
    if (roleIds.length === 0 && userIds.length === 0) {
      businessRule("Selecciona al menos un destinatario");
    }
    const allowed = new Set(scope.allowedRoleIds);
    if (!roleIds.every((id) => allowed.has(id))) {
      businessRule("No puedes difundir a uno o más de los roles seleccionados");
    }
  }

  let scheduledAt: Date;
  if (input.sendNow) {
    scheduledAt = new Date();
  } else {
    const parsed = input.scheduledAtLocal
      ? fromDatetimeLocalMX(input.scheduledAtLocal)
      : null;
    // `fromDatetimeLocalMX` hands back an Invalid Date (truthy!) for garbage
    // input — a null check alone would let it through as a valid schedule.
    if (!parsed || Number.isNaN(parsed.getTime())) {
      businessRule("La fecha y hora programadas no son válidas");
    }
    if ((parsed as Date).getTime() <= Date.now()) {
      businessRule("La fecha programada debe estar en el futuro");
    }
    scheduledAt = parsed as Date;
  }

  return {
    title: title as string,
    message: message as string,
    kind: input.kind,
    sendInApp: input.sendInApp,
    sendEmail: input.sendEmail,
    allRoles: input.allRoles,
    roleIds,
    userIds,
    includeSender: input.includeSender,
    scheduledAt,
  };
}

function revalidateBroadcastPaths(): void {
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/notifications/broadcast");
  revalidatePath("/notifications");
}

export interface BroadcastTargetRole {
  id: number;
  name: string;
  description: string | null;
}

/** Roles the caller may address, for the composer (fail closed: may be none). */
export async function getMyBroadcastTargets(): Promise<{
  roles: BroadcastTargetRole[];
  canTargetAll: boolean;
}> {
  const user = await requirePermission("notifications:broadcast");
  const scope = await getSenderBroadcastScope(
    user.id,
    user.isSuperuser === true,
  );
  if (scope.allowedRoleIds.length === 0) {
    return { roles: [], canTargetAll: false };
  }
  const roles = await prisma.role.findMany({
    where: { id: { in: scope.allowedRoleIds }, active: true },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
  return { roles, canTargetAll: scope.canTargetAll };
}

/** Live recipient preview for the composer (clamped to the sender's scope). */
export async function previewBroadcastRecipients(input: {
  roleIds: number[];
  allRoles: boolean;
  includeSender: boolean;
}): Promise<{ count: number }> {
  const user = await requirePermission("notifications:broadcast");
  const scope = await getSenderBroadcastScope(
    user.id,
    user.isSuperuser === true,
  );
  const useAll = input.allRoles && scope.canTargetAll;
  const picked = useAll
    ? null
    : [...new Set(input.roleIds)].filter((id) =>
        scope.allowedRoleIds.includes(id),
      );
  const ids =
    picked === null
      ? await broadcastAudience({ all: true, roleIds: [] })
      : picked.length === 0
        ? []
        : await broadcastAudience({ all: false, roleIds: picked });
  const deduped = [...new Set(ids)];
  return {
    count: input.includeSender
      ? deduped.length
      : deduped.filter((id) => id !== user.id).length,
  };
}

/**
 * Create a broadcast. `sendNow` dispatches it in the same request
 * (create + `dispatchBroadcast`); otherwise it stays PROGRAMADA for the cron.
 */
export async function createBroadcast(
  input: BroadcastFormInput,
): Promise<ActionResult<{ id: string; status: string }>> {
  return guarded(async () => {
    const user = await requirePermission("notifications:broadcast");
    const scope = await getSenderBroadcastScope(
      user.id,
      user.isSuperuser === true,
    );
    const data = await assertBroadcastInput(input, scope, user.id);

    const broadcast = await prisma.broadcast.create({
      data: {
        title: data.title,
        message: data.message,
        kind: data.kind,
        sendInApp: data.sendInApp,
        sendEmail: data.sendEmail,
        allRoles: data.allRoles,
        includeSender: data.includeSender,
        scheduledAt: data.scheduledAt,
        status: BroadcastStatus.PROGRAMADA,
        createdById: user.id,
        roles: data.allRoles
          ? undefined
          : {
              create: data.roleIds.map((roleId) => ({
                roleId,
                createdById: user.id,
              })),
            },
        users:
          data.userIds.length === 0
            ? undefined
            : {
                create: data.userIds.map((userId) => ({
                  userId,
                  createdById: user.id,
                })),
              },
      },
      select: { id: true },
    });
    revalidateBroadcastPaths();

    if (data.scheduledAt && input.sendNow) {
      await dispatchBroadcast(broadcast.id);
      const sent = await prisma.broadcast.findUnique({
        where: { id: broadcast.id },
        select: { status: true },
      });
      return ok({
        id: broadcast.id,
        status: sent?.status ?? BroadcastStatus.ENVIADA,
      });
    }
    return ok({ id: broadcast.id, status: BroadcastStatus.PROGRAMADA });
  });
}

/** Edit a scheduled broadcast (PROGRAMADA only). The schedule stays future. */
export async function updateBroadcast(
  id: string,
  input: UpdateBroadcastInput,
): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const user = await requirePermission("notifications:broadcast");
    const existing = await prisma.broadcast.findUnique({
      where: { id },
      select: { status: true, active: true },
    });
    if (!existing || !existing.active) {
      businessRule("La difusión ya no existe");
    }
    if (
      (existing as { status: BroadcastStatus }).status !==
      BroadcastStatus.PROGRAMADA
    ) {
      businessRule("Solo se pueden editar difusiones programadas");
    }
    const scope = await getSenderBroadcastScope(
      user.id,
      user.isSuperuser === true,
    );
    const data = await assertBroadcastInput(
      { ...input, sendNow: false },
      scope,
      user.id,
    );

    await prisma.$transaction(async (tx) => {
      await tx.broadcast.update({
        where: { id },
        data: {
          title: data.title,
          message: data.message,
          kind: data.kind,
          sendInApp: data.sendInApp,
          sendEmail: data.sendEmail,
          allRoles: data.allRoles,
          includeSender: data.includeSender,
          scheduledAt: data.scheduledAt,
          updatedById: user.id,
        },
      });
      // Pivot replace, like role permissions: the audience is the new set.
      await tx.broadcastRole.deleteMany({ where: { broadcastId: id } });
      if (!data.allRoles && data.roleIds.length > 0) {
        await tx.broadcastRole.createMany({
          data: data.roleIds.map((roleId) => ({
            broadcastId: id,
            roleId,
            createdById: user.id,
          })),
        });
      }
      // Per-user rows are DEACTIVATED, never deleted: the history of who was
      // addressed stays queryable after the edit.
      await tx.broadcastUser.updateMany({
        where: {
          broadcastId: id,
          active: true,
          userId: { notIn: data.userIds },
        },
        data: {
          active: false,
          updatedById: user.id,
          deactivatedAt: new Date(),
          deactivatedById: user.id,
        },
      });
      for (const userId of data.userIds) {
        await tx.broadcastUser.upsert({
          where: { broadcastId_userId: { broadcastId: id, userId } },
          update: { active: true, updatedById: user.id },
          create: { broadcastId: id, userId, createdById: user.id },
        });
      }
    });
    revalidateBroadcastPaths();
    return ok({ id });
  });
}

/** Cancel a scheduled broadcast (PROGRAMADA only). */
export async function cancelBroadcast(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    await requirePermission("notifications:broadcast");
    const existing = await prisma.broadcast.findUnique({
      where: { id },
      select: { status: true, active: true },
    });
    if (!existing || !existing.active) {
      businessRule("La difusión ya no existe");
    }
    if (
      (existing as { status: BroadcastStatus }).status !==
      BroadcastStatus.PROGRAMADA
    ) {
      businessRule("Solo se pueden cancelar difusiones programadas");
    }
    await prisma.broadcast.update({
      where: { id },
      data: { status: BroadcastStatus.CANCELADA },
    });
    revalidateBroadcastPaths();
    return ok({ id });
  });
}

export interface BroadcastListRow {
  id: string;
  title: string;
  message: string;
  kind: BroadcastKindInput;
  sendInApp: boolean;
  sendEmail: boolean;
  allRoles: boolean;
  includeSender: boolean;
  scheduledAt: Date;
  status: BroadcastStatus;
  sentAt: Date | null;
  recipientCount: number;
  createdByName: string | null;
  roles: Array<{ id: number; name: string }>;
  createdAt: Date;
}

/** Scheduled + history for the admin table (newest first, capped at 100). */
export async function listBroadcasts(): Promise<BroadcastListRow[]> {
  await requirePermission("notifications:broadcast");
  const rows = await prisma.broadcast.findMany({
    where: { active: true },
    include: {
      roles: {
        where: { active: true },
        include: { role: { select: { id: true, name: true } } },
      },
    },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });
  const senderIds = [
    ...new Set(rows.map((r) => r.createdById).filter(Boolean)),
  ];
  const senders =
    senderIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: senderIds as string[] } },
          select: { id: true, name: true },
        });
  const names = new Map(senders.map((s) => [s.id, s.name]));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    kind: row.kind as BroadcastKindInput,
    sendInApp: row.sendInApp,
    sendEmail: row.sendEmail,
    allRoles: row.allRoles,
    includeSender: row.includeSender,
    scheduledAt: row.scheduledAt,
    status: row.status,
    sentAt: row.sentAt,
    recipientCount: row.recipientCount,
    createdByName: row.createdById
      ? (names.get(row.createdById) ?? null)
      : null,
    roles: row.roles.map((r) => ({ id: r.role.id, name: r.role.name })),
    createdAt: row.createdAt,
  }));
}

/** Which roles a role may broadcast to (for `/admin/roles/[id]`, ROOT edits). */
export async function getRoleBroadcastTargets(
  roleId: number,
): Promise<{ targetIds: number[] }> {
  await requirePermission("roles:read");
  const rows = await prisma.roleBroadcastTarget.findMany({
    where: { sourceRoleId: roleId, active: true },
    select: { targetRoleId: true },
  });
  return { targetIds: rows.map((r) => r.targetRoleId) };
}

/**
 * Replace a role's broadcast targets. ROOT only (`assertCanManageRoles`) —
 * granting reach is granting power, like granting roles themselves.
 */
export async function setRoleBroadcastTargets(
  roleId: number,
  targetIds: number[],
): Promise<ActionResult> {
  return guarded(async () => {
    const caller = await requirePermission("roles:update");
    assertCanManageRoles(caller);

    const unique = [...new Set(targetIds)];
    if (unique.length > 0) {
      const roles = await prisma.role.findMany({
        where: { id: { in: unique }, active: true },
        select: { id: true },
      });
      if (roles.length !== unique.length) {
        businessRule("Uno o más roles no existen o están inactivos.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.roleBroadcastTarget.updateMany({
        where: {
          sourceRoleId: roleId,
          targetRoleId: { notIn: unique },
        },
        data: { active: false },
      });
      for (const targetRoleId of unique) {
        await tx.roleBroadcastTarget.upsert({
          where: {
            sourceRoleId_targetRoleId: {
              sourceRoleId: roleId,
              targetRoleId,
            },
          },
          update: { active: true },
          create: { sourceRoleId: roleId, targetRoleId, active: true },
        });
      }
    });

    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${roleId}`);
    return ok();
  });
}
