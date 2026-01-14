import { prisma } from "@/lib/database/prisma.singleton";

/**
 * Get all VICs assigned to a user
 */
export async function getUserVics(userId: string) {
  const assignments = await prisma.userVicAssignment.findMany({
    where: { userId, active: true },
    include: { vic: true },
  });

  return assignments.map((a) => a.vic);
}

/**
 * Get user's VIC IDs
 */
export async function getUserVicIds(userId: string): Promise<string[]> {
  const assignments = await prisma.userVicAssignment.findMany({
    where: { userId, active: true },
    select: { vicId: true },
  });

  return assignments.map((a) => a.vicId);
}

/**
 * Get user's primary VIC
 */
export async function getPrimaryVic(userId: string) {
  const assignment = await prisma.userVicAssignment.findFirst({
    where: { userId, isPrimary: true, active: true },
    include: { vic: true },
  });

  return assignment?.vic ?? null;
}

/**
 * Get user's primary VIC ID
 */
export async function getPrimaryVicId(userId: string): Promise<string | null> {
  const assignment = await prisma.userVicAssignment.findFirst({
    where: { userId, isPrimary: true, active: true },
    select: { vicId: true },
  });

  return assignment?.vicId ?? null;
}

/**
 * Check if user has access to a specific VIC
 */
export async function userHasAccessToVic(
  userId: string,
  vicId: string,
): Promise<boolean> {
  const assignment = await prisma.userVicAssignment.findUnique({
    where: {
      userId_vicId: { userId, vicId },
    },
  });

  return assignment?.active ?? false;
}

/**
 * Assign user to a VIC
 */
export async function assignUserToVic(
  userId: string,
  vicId: string,
  isPrimary = false,
) {
  // If setting as primary, unset other primary assignments
  if (isPrimary) {
    await prisma.userVicAssignment.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return await prisma.userVicAssignment.upsert({
    where: {
      userId_vicId: { userId, vicId },
    },
    update: { isPrimary, active: true },
    create: { userId, vicId, isPrimary },
  });
}

/**
 * Remove user from a VIC (soft delete)
 */
export async function removeUserFromVic(userId: string, vicId: string) {
  return await prisma.userVicAssignment.update({
    where: {
      userId_vicId: { userId, vicId },
    },
    data: { active: false },
  });
}

/**
 * Set a VIC as the user's primary VIC
 */
export async function setPrimaryVic(userId: string, vicId: string) {
  // Verify the assignment exists and is active
  const assignment = await prisma.userVicAssignment.findUnique({
    where: {
      userId_vicId: { userId, vicId },
    },
  });

  if (!assignment || !assignment.active) {
    throw new Error("User is not assigned to this VIC");
  }

  // Unset all other primary assignments
  await prisma.userVicAssignment.updateMany({
    where: { userId, isPrimary: true },
    data: { isPrimary: false },
  });

  // Set this one as primary
  return await prisma.userVicAssignment.update({
    where: {
      userId_vicId: { userId, vicId },
    },
    data: { isPrimary: true },
  });
}

/**
 * Get all users assigned to a VIC
 */
export async function getVicUsers(vicId: string) {
  const assignments = await prisma.userVicAssignment.findMany({
    where: { vicId, active: true },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return assignments.map((a) => ({
    ...a.user,
    isPrimary: a.isPrimary,
  }));
}

/**
 * Migrate existing vicId to vicAssignments
 * Run this once after deploying the new schema
 */
export async function migrateVicAssignments() {
  const users = await prisma.user.findMany({
    where: { vicId: { not: null } },
    select: { id: true, vicId: true },
  });

  let migrated = 0;

  for (const user of users) {
    if (!user.vicId) continue;

    // Check if assignment already exists
    const existing = await prisma.userVicAssignment.findUnique({
      where: {
        userId_vicId: { userId: user.id, vicId: user.vicId },
      },
    });

    if (!existing) {
      await prisma.userVicAssignment.create({
        data: {
          userId: user.id,
          vicId: user.vicId,
          isPrimary: true, // Existing vicId becomes primary
        },
      });
      migrated++;
    }
  }

  console.log(`Migrated ${migrated} user VIC assignments`);
  return migrated;
}
