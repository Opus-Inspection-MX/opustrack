import { includeRoles } from "@/lib/authz/user-queries";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * Get all Clients assigned to a user
 */
export async function getUserClients(userId: string) {
  const assignments = await prisma.userClientAssignment.findMany({
    where: { userId, active: true },
    include: { client: true },
  });

  return assignments.map((a) => a.client);
}

/**
 * Get user's Client IDs
 */
export async function getUserClientIds(userId: string): Promise<string[]> {
  const assignments = await prisma.userClientAssignment.findMany({
    where: { userId, active: true },
    select: { clientId: true },
  });

  return assignments.map((a) => a.clientId);
}

/**
 * Get user's primary Client
 */
export async function getPrimaryClient(userId: string) {
  const assignment = await prisma.userClientAssignment.findFirst({
    where: { userId, isPrimary: true, active: true },
    include: { client: true },
  });

  return assignment?.client ?? null;
}

/**
 * Get user's primary Client ID
 */
export async function getPrimaryClientId(
  userId: string,
): Promise<string | null> {
  const assignment = await prisma.userClientAssignment.findFirst({
    where: { userId, isPrimary: true, active: true },
    select: { clientId: true },
  });

  return assignment?.clientId ?? null;
}

/**
 * Check if user has access to a specific Client
 */
export async function userHasAccessToClient(
  userId: string,
  clientId: string,
): Promise<boolean> {
  const assignment = await prisma.userClientAssignment.findUnique({
    where: {
      userId_clientId: { userId, clientId },
    },
  });

  return assignment?.active ?? false;
}

/**
 * Assign user to a Client
 */
export async function assignUserToClient(
  userId: string,
  clientId: string,
  isPrimary = false,
) {
  // If setting as primary, unset other primary assignments
  if (isPrimary) {
    await prisma.userClientAssignment.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const assignment = await prisma.userClientAssignment.upsert({
    where: {
      userId_clientId: { userId, clientId },
    },
    update: { isPrimary, active: true },
    create: { userId, clientId, isPrimary },
  });

  return assignment;
}

/**
 * Remove user from a Client (soft delete)
 */
export async function removeUserFromClient(userId: string, clientId: string) {
  const assignment = await prisma.userClientAssignment.update({
    where: {
      userId_clientId: { userId, clientId },
    },
    data: { active: false },
  });

  return assignment;
}

/**
 * Set a Client as the user's primary Client
 */
export async function setPrimaryClient(userId: string, clientId: string) {
  // Verify the assignment exists and is active
  const assignment = await prisma.userClientAssignment.findUnique({
    where: {
      userId_clientId: { userId, clientId },
    },
  });

  if (!assignment || !assignment.active) {
    throw new Error("User is not assigned to this Client");
  }

  // Unset all other primary assignments
  await prisma.userClientAssignment.updateMany({
    where: { userId, isPrimary: true },
    data: { isPrimary: false },
  });

  // Set this one as primary
  const promoted = await prisma.userClientAssignment.update({
    where: {
      userId_clientId: { userId, clientId },
    },
    data: { isPrimary: true },
  });

  return promoted;
}

/**
 * Get all users assigned to a Client
 */
export async function getClientUsers(clientId: string) {
  const assignments = await prisma.userClientAssignment.findMany({
    where: { clientId, active: true },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          ...includeRoles,
        },
      },
    },
  });

  return assignments.map((a) => ({
    ...a.user,
    isPrimary: a.isPrimary,
  }));
}
