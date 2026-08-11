import { expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { assertEphemeralDatabase } from "./ephemeral-db";

/**
 * Database access for e2e assertions.
 *
 * The specs drive the UI; this reads the resulting rows. Asserting on state the
 * user cannot see — the derived incident status, the notification rows — is the
 * whole point of the lifecycle spec, and there is no UI surface that exposes it
 * all in one place.
 *
 * Every call re-checks that the target is the throwaway container.
 */

let client: PrismaClient | null = null;

export function db(): PrismaClient {
  if (!client) {
    assertEphemeralDatabase(process.env.DATABASE_URL);
    client = new PrismaClient();
  }
  return client;
}

export async function disconnectDb(): Promise<void> {
  await client?.$disconnect();
  client = null;
}

/**
 * Unique suffix for a run, so titles never collide across re-runs and the suite
 * does not depend on a freshly wiped database.
 */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

export interface LifecycleIncident {
  id: number;
  title: string;
  statusName: string | null;
  clienteId: string | null;
  reportedById: string | null;
  scheduleId: string | null;
  resolvedAt: Date | null;
}

/** Look up an incident by its exact title, with the fields the spec asserts on. */
export async function findIncidentByTitle(
  title: string,
): Promise<LifecycleIncident | null> {
  const incident = await db().incident.findFirst({
    where: { title },
    select: {
      id: true,
      title: true,
      clienteId: true,
      reportedById: true,
      scheduleId: true,
      resolvedAt: true,
      status: { select: { name: true } },
    },
    orderBy: { id: "desc" },
  });

  if (!incident) return null;
  const { status, ...rest } = incident;
  return { ...rest, statusName: status?.name ?? null };
}

/**
 * Poll until the incident reaches `statusName`.
 *
 * The incident status is derived from its assignments by `syncIncidentState`,
 * which runs inside the server action that the UI click triggered. Waiting for
 * the UI alone would not prove the derivation happened.
 */
export async function expectIncidentStatus(
  incidentId: number,
  statusName: string,
): Promise<LifecycleIncident> {
  let last: string | null = null;

  await expect(async () => {
    const incident = await db().incident.findUnique({
      where: { id: incidentId },
      select: { status: { select: { name: true } } },
    });
    last = incident?.status?.name ?? null;
    expect(last, `estado del incidente ${incidentId}`).toBe(statusName);
  }).toPass({ timeout: 15_000 });

  const incident = await findIncidentByTitle(
    (
      await db().incident.findUniqueOrThrow({
        where: { id: incidentId },
        select: { title: true },
      })
    ).title,
  );
  return incident as LifecycleIncident;
}

/** Poll until the assignment reaches `statusName`, then return its row. */
export async function expectAssignmentStatus(
  assignmentId: string,
  statusName: string,
) {
  await expect(async () => {
    const assignment = await db().assignment.findUnique({
      where: { id: assignmentId },
      select: { status: { select: { name: true } } },
    });
    expect(
      assignment?.status?.name ?? null,
      `estado de la asignación ${assignmentId}`,
    ).toBe(statusName);
  }).toPass({ timeout: 15_000 });

  return db().assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: {
      id: true,
      odtFolio: true,
      seenAt: true,
      seenById: true,
      startedAt: true,
      finishedAt: true,
      startLatitude: true,
      startLongitude: true,
      endLatitude: true,
      endLongitude: true,
      status: { select: { name: true } },
    },
  });
}

/** The newest active assignment of an incident, or null. */
export async function findAssignmentForIncident(incidentId: number) {
  return db().assignment.findFirst({
    where: { incidentId, active: true },
    select: { id: true, status: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Poll until the incident has an active assignment, and return its id.
 *
 * `waitForURL` resolves as soon as the client-side navigation starts, which is
 * not the same instant the server action's transaction becomes visible to
 * another connection. Reading once right after the redirect is a race.
 */
export async function expectAssignmentForIncident(
  incidentId: number,
): Promise<string> {
  let assignmentId: string | null = null;

  await expect(async () => {
    const assignment = await findAssignmentForIncident(incidentId);
    expect(
      assignment,
      `el incidente ${incidentId} debe tener una asignación activa`,
    ).not.toBeNull();
    assignmentId = assignment?.id ?? null;
  }).toPass({ timeout: 15_000 });

  return assignmentId as unknown as string;
}

/**
 * Poll until `userEmail` has a notification of `type` for `entityId`.
 *
 * Notifications are dispatched after the transaction commits and never throw
 * (see `emit()` in src/lib/notifications/notify-events.ts), so they can land
 * slightly after the UI settles.
 */
export async function expectNotification(params: {
  userEmail: string;
  type: string;
  entityId?: string;
}): Promise<void> {
  const { userEmail, type, entityId } = params;

  await expect(async () => {
    const count = await db().notification.count({
      where: {
        type,
        active: true,
        ...(entityId ? { entityId } : {}),
        user: { email: userEmail },
      },
    });
    expect(
      count,
      `notificación "${type}" para ${userEmail}${entityId ? ` (entidad ${entityId})` : ""}`,
    ).toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });
}

/** Assert `userEmail` has NO notification of `type` for `entityId`. */
export async function expectNoNotification(params: {
  userEmail: string;
  type: string;
  entityId: string;
}): Promise<void> {
  const count = await db().notification.count({
    where: {
      type: params.type,
      active: true,
      entityId: params.entityId,
      user: { email: params.userEmail },
    },
  });
  expect(
    count,
    `${params.userEmail} no debería tener "${params.type}" de ${params.entityId}`,
  ).toBe(0);
}

/**
 * Satisfy the two preconditions the FSR page enforces before "Cerrar trabajo":
 * an ODT folio and at least one attachment
 * (src/app/fsr/assignments/[id]/page.tsx:394-404).
 *
 * Done directly rather than through the UI on purpose: folio capture and file
 * upload are separate features with their own screens. Driving them here would
 * make this spec fail whenever either one changes, for reasons unrelated to the
 * state machine it exists to protect. They deserve their own spec.
 */
export async function prepareAssignmentForClose(
  assignmentId: string,
): Promise<void> {
  await db().assignment.update({
    where: { id: assignmentId },
    data: { odtFolio: `ODT-E2E-${uniqueSuffix()}` },
  });

  const existing = await db().assignmentAttachment.count({
    where: { assignmentId, active: true },
  });

  if (existing === 0) {
    await db().assignmentAttachment.create({
      data: {
        assignmentId,
        filename: "evidencia-e2e.pdf",
        filepath: "/uploads/e2e/evidencia-e2e.pdf",
        // Deliberately NOT an image. The gate only counts attachments, but
        // AttachmentPreview renders image mimetypes through next/image, which
        // then tries to optimise a file that does not exist and logs "isn't a
        // valid image … received null". A non-image renders an icon instead —
        // no file needed, and no binary fixture in the repo. (Writing the file
        // at runtime does not help either: `next start` serves public/ from the
        // build manifest, so anything created afterwards is invisible.)
        mimetype: "application/pdf",
        size: 1024,
        provider: "filesystem",
      },
    });
  }
}
