"use server";

import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { serializableTransaction } from "@/lib/database/serializable-transaction";
import { renderEmail } from "@/lib/mail/templates";
import { getMailTransport } from "@/lib/mail/transport";
import { logger } from "@/lib/observability/logger";
import { hashPassword } from "@/lib/security/hash";
import {
  type ActionResult,
  businessRule,
  guarded,
  ok,
  rejected,
} from "./result";

const INVALID_LINK =
  "El enlace no es válido o ha expirado. Solicita uno nuevo.";
const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const eligibleAccount = {
  active: true,
  userStatus: { code: "ACTIVO" },
  userRoles: { some: { active: true, role: { active: true } } },
} as const;

/** Configuration, never the incoming Host header, determines the recovery origin. */
function recoveryUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL;
  if (!base) throw new Error("Recovery origin is not configured");
  const url = new URL("/reset-password", base);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error("Recovery origin must use HTTPS outside localhost");
  // Fragments are not sent in HTTP requests, access logs, or referrers.
  url.hash = token;
  return url.toString();
}

export async function requestPasswordRecovery(
  email: string,
): Promise<ActionResult> {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return rejected("Ingresa un correo electrónico válido.");
  }
  const address = email.trim();
  // All account lookup, throttling and SMTP happen AFTER the identical response.
  // Delivery is intentionally outside the operational outbox: its bodies persist secrets.
  after(async () => {
    try {
      const transport = getMailTransport();
      if (transport.name === "noop") {
        logger.error("password-recovery.smtp-unconfigured");
        return;
      }
      const token = randomBytes(32).toString("hex");
      const link = recoveryUrl(token);
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const recipient = await serializableTransaction(async (tx) => {
        // Match the exact stored email, as credentials sign-in already does.
        const user = await tx.user.findFirst({
          where: { email: address, ...eligibleAccount },
          select: { id: true, email: true, sessionVersion: true },
        });
        if (!user) return null;
        const now = new Date();
        const existing = await tx.passwordResetToken.findUnique({
          where: { userId: user.id },
        });
        if (
          existing &&
          now.getTime() - existing.requestedAt.getTime() < RESEND_COOLDOWN_MS
        )
          return null;
        const data = {
          tokenHash,
          sessionVersion: user.sessionVersion,
          requestedAt: now,
          expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
          consumedAt: null,
        };
        await tx.passwordResetToken.upsert({
          where: { userId: user.id },
          create: { userId: user.id, ...data },
          update: data,
        });
        return user.email;
      });
      if (!recipient) return;
      await transport.send({
        to: [recipient],
        ...renderEmail({
          subject: "Restablece tu contraseña de OpusTrack",
          intro:
            "Recibimos una solicitud para restablecer tu contraseña. Este enlace es de un solo uso y vence en 30 minutos. Si no lo solicitaste, ignora este correo.",
          link,
          cta: "Restablecer contraseña",
        }),
      });
    } catch {
      // SMTP errors can contain addresses, message bodies or bearer links.
      logger.error("password-recovery.delivery-failed");
    }
  });
  return ok();
}

export async function resetRecoveredPassword(
  token: string,
  password: string,
  confirmation: string,
): Promise<ActionResult> {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    return rejected(INVALID_LINK);
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return rejected(
      "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes.",
    );
  }
  if (password !== confirmation)
    return rejected("Las contraseñas no coinciden.");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return guarded(async () => {
    // Cheap digest lookup before expensive bcrypt; recheck under the write transaction.
    const usable = await serializableTransaction(async (tx) => {
      const reset = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      return Boolean(
        reset && !reset.consumedAt && reset.expiresAt > new Date(),
      );
    });
    if (!usable) businessRule(INVALID_LINK);
    // Hash outside the retry callback. The transaction contains database work only.
    const hashed = await hashPassword(password);
    await serializableTransaction(async (tx) => {
      const reset = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      const now = new Date();
      if (!reset || reset.consumedAt || reset.expiresAt <= now)
        businessRule(INVALID_LINK);
      const changed = await tx.user.updateMany({
        where: {
          id: reset.userId,
          sessionVersion: reset.sessionVersion,
          ...eligibleAccount,
        },
        data: { password: hashed, sessionVersion: { increment: 1 } },
      });
      if (changed.count !== 1) businessRule(INVALID_LINK);
      const consumed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) businessRule(INVALID_LINK);
    });
    return {};
  });
}
