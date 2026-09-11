"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/auth";
import { assertClientAccessAsync } from "@/lib/auth/filters";
import { userHasPermission } from "@/lib/authz/authz";
import { codeOf, INCIDENT_STATE } from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";
import { businessRule, guarded } from "./result";

/**
 * Evidence photos filed WITH the incident report (RF-217).
 *
 * Mirrors the RF-259 assignment-attachment contract: 10MB per file, shared
 * MIME allowlist, FormData with File (no base64), per-row provider,
 * soft-delete in DB + physical provider delete. Unlike RF-259, attachments
 * are NEVER required — reporting must never be blocked for lack of photos.
 *
 * Permission gate is create OR update: REPORTER-role users hold
 * `incidents:create` (no `incidents:update`), while operations admins and
 * FSRs hold `incidents:update`. Terminal-state block matches assignments:
 * nothing moves on CERRADO/CANCELADA.
 */

function revalidateIncidentAttachmentPaths(incidentId: number) {
  revalidatePath(`/admin/incidents/${incidentId}`);
  revalidatePath("/admin/incidents");
  revalidatePath(`/reporter/incidents/${incidentId}`);
  revalidatePath("/reporter/incidents");
  revalidatePath("/reporter");
}

/**
 * Require incidents:create OR incidents:update.
 *
 * A single requirePermission cannot express the OR: the reporter (REPORTER)
 * creates, the operator (ADMIN/FSR) updates. Permission denials stay
 * exceptions, never toasts — same rule as every other action boundary.
 */
async function requireIncidentAttachmentAccess() {
  const user = await requireAuth();
  if (
    !userHasPermission(user, "incidents:create") &&
    !userHasPermission(user, "incidents:update")
  ) {
    throw new Error("Permission denied: incidents:create or incidents:update");
  }
  return user;
}

/**
 * Block writes when the parent incident is terminal (CERRADO/CANCELADA).
 * Same wording as the assignment-side guard so operators see one message.
 */
async function assertIncidentAttachable(incidentId: number): Promise<{
  clientId: string | null;
}> {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: {
      clientId: true,
      status: { select: { code: true, name: true } },
    },
  });
  if (!incident) {
    throw new Error("Incidencia no encontrada");
  }
  // Stable code (H-08): a renamed label must still block writes.
  const name = codeOf(incident.status);
  if (name === INCIDENT_STATE.CERRADO || name === INCIDENT_STATE.CANCELADA) {
    businessRule(
      name === INCIDENT_STATE.CANCELADA
        ? "La incidencia está cancelada. No se pueden hacer cambios."
        : "La incidencia está cerrada. No se pueden hacer cambios.",
    );
  }
  return { clientId: incident.clientId };
}

/**
 * Upload an evidence file for an incident (multipart FormData).
 *
 * Expected FormData fields:
 *  - incidentId: string (required, integer id as string)
 *  - file: File (required)
 *  - mimetype: string (optional; client-normalized override for File.type)
 *  - description: string (optional)
 */
export async function uploadIncidentAttachment(formData: FormData) {
  const user = await requireIncidentAttachmentAccess();

  return guarded(async () => {
    const incidentIdField = formData.get("incidentId");
    const file = formData.get("file");
    const mimetypeField = formData.get("mimetype");
    const descriptionField = formData.get("description");

    const incidentId =
      typeof incidentIdField === "string" ? Number(incidentIdField) : NaN;
    if (!Number.isInteger(incidentId)) {
      businessRule("Identificador de incidente inválido");
    }
    if (!(file instanceof File)) {
      businessRule("Archivo inválido");
    }

    const mimetype =
      (typeof mimetypeField === "string" && mimetypeField.trim()) ||
      file.type ||
      "application/octet-stream";

    // Dynamic import on purpose: file-storage pulls in `@vercel/blob`, which
    // every incident read would otherwise pay for (same reason as RF-259).
    const { assertAllowedUpload, uploadFileFromBuffer } = await import(
      "@/lib/storage/file-storage"
    );
    assertAllowedUpload(mimetype, file.size);

    const { clientId } = await assertIncidentAttachable(incidentId);
    if (clientId) {
      await assertClientAccessAsync(user, clientId);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadResult = await uploadFileFromBuffer(
      file.name,
      buffer,
      mimetype,
      {
        subfolder: "incidents",
      },
    );

    const description =
      typeof descriptionField === "string" && descriptionField.trim() !== ""
        ? descriptionField.trim()
        : null;

    const attachment = await prisma.incidentAttachment.create({
      data: {
        incidentId,
        filename: uploadResult.filename,
        filepath: uploadResult.url,
        mimetype: uploadResult.mimetype,
        size: uploadResult.size,
        description,
        provider: uploadResult.provider,
      },
    });

    revalidateIncidentAttachmentPaths(incidentId);

    return { data: attachment };
  });
}

/**
 * Delete an incident attachment: soft-delete the row, then remove the blob
 * from the row's stored provider. A physical-delete failure is logged and
 * does NOT fail the operation (RF-259 rule: the DB row is the source of
 * truth, an orphaned blob is inert).
 */
export async function deleteIncidentAttachment(id: string) {
  const user = await requireIncidentAttachmentAccess();

  return guarded(async () => {
    const attachment = await prisma.incidentAttachment.findUnique({
      where: { id },
      include: { incident: { select: { clientId: true } } },
    });

    if (!attachment) {
      throw new Error("Attachment not found");
    }

    const { clientId } = await assertIncidentAttachable(attachment.incidentId);
    if (clientId) {
      await assertClientAccessAsync(user, clientId);
    }

    await prisma.incidentAttachment.update({
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
      logger.error("Error deleting file:", error);
    }

    revalidateIncidentAttachmentPaths(attachment.incidentId);

    return {};
  });
}
