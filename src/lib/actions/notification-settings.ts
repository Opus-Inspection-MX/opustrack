"use server";

import { AuditAction, AuditEntity, EmailOutboxStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/log-audit";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { getMailTransport } from "@/lib/mail";
import { MAX_EMAIL_ATTEMPTS, retryDueEmails } from "@/lib/mail/outbox";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_GROUPS,
  type NotificationGroup,
} from "@/lib/notifications/catalog";
import { clearChannelPolicyCache } from "@/lib/notifications/dispatch";
import type { NotificationType } from "@/lib/notifications/notification-types";
import {
  type ActionResult,
  businessRule,
  guarded,
  ok,
  rejected,
} from "./result";

/**
 * Channel matrix + SMTP settings (Phase 2 screen, ROOT only via
 * `notifications:configure`). Business rules are RETURNED in Spanish;
 * permission denials keep throwing (they redirect, never toast).
 */

const MATRIX_PATH = "/admin/settings/notifications";

export interface ChannelMatrixRow {
  type: NotificationType;
  label: string;
  group: NotificationGroup;
  inApp: boolean;
  email: boolean;
}

/** Every catalog event with its stored policy (or catalog defaults). */
export async function getChannelMatrix(): Promise<ChannelMatrixRow[]> {
  await requirePermission("notifications:configure");
  const policies = await prisma.notificationChannelPolicy.findMany();
  const byType = new Map(policies.map((p) => [p.type, p]));
  const order = new Map(
    NOTIFICATION_GROUPS.flatMap((group) => groupEvents(group)).map(
      (type, index) => [type, index],
    ),
  );
  const rows: ChannelMatrixRow[] = (
    Object.keys(NOTIFICATION_EVENTS) as NotificationType[]
  ).map((type) => {
    const stored = byType.get(type);
    const defaults = NOTIFICATION_EVENTS[type].defaultChannels;
    return {
      type,
      label: NOTIFICATION_EVENTS[type].label,
      group: NOTIFICATION_EVENTS[type].group,
      inApp: stored?.inApp ?? defaults.inApp,
      email: stored?.email ?? defaults.email,
    };
  });
  return rows.sort(
    (a, b) => (order.get(a.type) ?? 0) - (order.get(b.type) ?? 0),
  );
}

function groupEvents(group: NotificationGroup): NotificationType[] {
  return (Object.keys(NOTIFICATION_EVENTS) as NotificationType[]).filter(
    (type) => NOTIFICATION_EVENTS[type].group === group,
  );
}

export interface ChannelPolicyInput {
  type: string;
  inApp: boolean;
  email: boolean;
}

function assertMatrixInput(rows: ChannelPolicyInput[]): void {
  if (!Array.isArray(rows) || rows.length === 0) {
    businessRule("La matriz no trae cambios para guardar");
  }
  for (const row of rows) {
    if (!(row.type in NOTIFICATION_EVENTS)) {
      businessRule(`Evento desconocido: ${row.type}`);
    }
    if (typeof row.inApp !== "boolean" || typeof row.email !== "boolean") {
      businessRule(`Valores no válidos para el evento ${row.type}`);
    }
  }
}

/**
 * Persist the matrix, audit it and invalidate the dispatch cache — in one
 * transaction, so the audit row and the policy rows never disagree.
 */
export async function saveChannelPolicies(
  rows: ChannelPolicyInput[],
): Promise<ActionResult> {
  return guarded(async () => {
    const { id: actorId } = await requirePermission("notifications:configure");
    assertMatrixInput(rows);
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.notificationChannelPolicy.upsert({
          where: { type: row.type },
          update: { inApp: row.inApp, email: row.email, updatedById: actorId },
          create: {
            type: row.type,
            inApp: row.inApp,
            email: row.email,
            createdById: actorId,
          },
        });
      }
      await logAudit(tx, {
        actorId,
        entity: AuditEntity.NOTIFICATION_CHANNEL,
        entityId: "matrix",
        action: AuditAction.UPDATE,
        payload: { reason: "channel-matrix-save" },
      });
    });
    clearChannelPolicyCache();
    revalidatePath(MATRIX_PATH);
    return ok();
  });
}

export interface SmtpStatus {
  transport: string;
  configured: boolean;
}

/** Which transport mail would use right now (`smtp(host:port)` or `noop`). */
export async function getSmtpStatus(): Promise<SmtpStatus> {
  await requirePermission("notifications:configure");
  const transport = getMailTransport();
  return { transport: transport.name, configured: transport.name !== "noop" };
}

/** Verify the connection and send a probe to my own address. */
export async function sendTestEmail(): Promise<ActionResult> {
  const user = await requirePermission("notifications:configure");
  if (!user.email) {
    return rejected("Tu usuario no tiene una dirección de correo");
  }
  const transport = getMailTransport();
  try {
    await transport.verify();
    await transport.send({
      to: [user.email],
      subject: "OpusTrack: correo de prueba",
      text: [
        "Este es un correo de prueba de OpusTrack.",
        "Si lo estás leyendo, el transporte SMTP está bien configurado.",
        "",
        "— OpusTrack",
      ].join("\n"),
    });
  } catch {
    return rejected(
      "No se pudo enviar el correo de prueba. Verifica la configuración SMTP",
    );
  }
  return ok();
}

export interface FailedEmailRow {
  id: string;
  notificationType: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
  recipientCount: number;
}

/** Latest failed rows for the SMTP panel (most recent first). */
export async function getFailedEmails(limit = 20): Promise<FailedEmailRow[]> {
  await requirePermission("notifications:configure");
  const rows = await prisma.emailOutbox.findMany({
    where: { status: EmailOutboxStatus.FALLIDO },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    notificationType: row.notificationType,
    subject: row.subject,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    nextAttemptAt: row.nextAttemptAt,
    createdAt: row.createdAt,
    recipientCount: row.recipients.length,
  }));
}

/** Retry one failed row now (resets its backoff, then runs the due queue). */
export async function retryFailedEmail(id: string): Promise<ActionResult> {
  return guarded(async () => {
    await requirePermission("notifications:configure");
    const row = await prisma.emailOutbox.findUnique({ where: { id } });
    if (!row) {
      businessRule("El correo ya no existe");
    }
    if (row.status !== EmailOutboxStatus.FALLIDO) {
      businessRule("Solo se pueden reintentar correos fallidos");
    }
    if (row.attempts >= MAX_EMAIL_ATTEMPTS) {
      businessRule("El correo alcanzó el máximo de intentos");
    }
    await prisma.emailOutbox.update({
      where: { id },
      data: { status: EmailOutboxStatus.PENDIENTE, nextAttemptAt: new Date() },
    });
    const summary = await retryDueEmails();
    revalidatePath(MATRIX_PATH);
    if (summary.sent === 0) {
      return rejected("El reintento falló. Revisa la configuración SMTP");
    }
    return ok();
  });
}
