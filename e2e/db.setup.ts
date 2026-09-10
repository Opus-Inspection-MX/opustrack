import { test as setup } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/security/hash";
import { account, ROLES } from "./fixtures/auth";
import { assertEphemeralDatabase } from "./fixtures/ephemeral-db";

/**
 * Database setup: guarantees every configured account exists and can log in,
 * before anything opens a browser. Runs as its own project so `auth.setup.ts`
 * depends on it.
 *
 * Two behaviours, decided per account:
 *
 * - **Missing** → created with the configured password, and given a Client
 *   assignment when the role needs one.
 * - **Already there** → only reactivated if needed. Its password is NEVER
 *   rewritten, so running against a container seeded with real personnel
 *   cannot modify anyone's credentials.
 *
 * Requires the role and status catalogs, created by `npm run e2e:up`.
 */
const prisma = new PrismaClient();

/**
 * Roles whose flows are scoped to a Client. REPORTER cannot even open an
 * incident without one — `createIncidentAsReporter` throws on a missing primary
 * Client — and FSR data is filtered by assignment.
 */
const NEEDS_CLIENT = new Set(["REPORTER", "FSR"]);

setup("provision e2e accounts", async () => {
  // Defence in depth: playwright.config.ts already asserted this before the
  // run started, but this is the process that actually writes.
  assertEphemeralDatabase(process.env.DATABASE_URL);

  const activeStatus = await prisma.userStatus.findFirst({
    where: { name: "ACTIVO" },
    select: { id: true },
  });

  if (!activeStatus) {
    throw new Error("UserStatus 'ACTIVO' no existe. Ejecuta `npm run e2e:up`.");
  }

  // Any real Client works for the roles that need one; the seed always
  // creates several. `SIN-CENTRO` is a placeholder, so it is skipped.
  const fallbackClient = await prisma.client.findFirst({
    where: { active: true, NOT: { code: "SIN-CENTRO" } },
    orderBy: { code: "asc" },
    select: { id: true },
  });

  for (const role of ROLES) {
    const { email, password, name, roleName } = account(role);

    const roleRecord = await prisma.role.findUnique({
      where: { name: roleName },
      select: { id: true },
    });

    if (!roleRecord) {
      throw new Error(
        `Rol '${roleName}' no existe. Ejecuta \`npm run e2e:up\`.`,
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        active: true,
        userRoles: { where: { active: true }, select: { roleId: true } },
      },
    });

    if (existing) {
      // "Holds" rather than "is": a user can carry several roles, so the check
      // is membership, not equality.
      const holdsRole = existing.userRoles.some(
        (ur) => ur.roleId === roleRecord.id,
      );
      if (!holdsRole) {
        throw new Error(
          `La cuenta ${email} no tiene el rol ${roleName}. Revisa las variables E2E_*_EMAIL.`,
        );
      }
      // Reactivate only — never touch the password of an account we did not create.
      if (!existing.active) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { active: true, userStatusId: activeStatus.id },
        });
      }
      await ensureClient(existing.id, roleName, fallbackClient?.id);
      continue;
    }

    const created = await prisma.user.create({
      data: {
        email,
        name,
        password: await hashPassword(password),
        userRoles: { create: [{ roleId: roleRecord.id }] },
        userStatusId: activeStatus.id,
        active: true,
      },
      select: { id: true },
    });

    await ensureClient(created.id, roleName, fallbackClient?.id);
  }

  await prisma.$disconnect();
});

/** Give the account a primary Client when its role needs one and it has none. */
async function ensureClient(
  userId: string,
  roleName: string,
  fallbackClientId: string | undefined,
): Promise<void> {
  if (!NEEDS_CLIENT.has(roleName)) return;

  const already = await prisma.userClientAssignment.findFirst({
    where: { userId, active: true },
    select: { id: true },
  });
  if (already) return;

  if (!fallbackClientId) {
    throw new Error(
      `No hay ningún Cliente activo para asignar al rol ${roleName}. ` +
        "Ejecuta `npm run e2e:up`.",
    );
  }

  await prisma.userClientAssignment.upsert({
    where: { userId_clientId: { userId, clientId: fallbackClientId } },
    update: { isPrimary: true, active: true },
    create: { userId, clientId: fallbackClientId, isPrimary: true },
  });
}
