import { prisma } from "@/lib/database/prisma.singleton";

/**
 * Get all Clientes assigned to a user
 */
export async function getUserClientes(userId: string) {
  const assignments = await prisma.userClienteAssignment.findMany({
    where: { userId, active: true },
    include: { cliente: true },
  });

  return assignments.map((a) => a.cliente);
}

/**
 * Get user's Cliente IDs
 */
export async function getUserClienteIds(userId: string): Promise<string[]> {
  const assignments = await prisma.userClienteAssignment.findMany({
    where: { userId, active: true },
    select: { clienteId: true },
  });

  return assignments.map((a) => a.clienteId);
}

/**
 * Get user's primary Cliente
 */
export async function getPrimaryCliente(userId: string) {
  const assignment = await prisma.userClienteAssignment.findFirst({
    where: { userId, isPrimary: true, active: true },
    include: { cliente: true },
  });

  return assignment?.cliente ?? null;
}

/**
 * Get user's primary Cliente ID
 */
export async function getPrimaryClienteId(
  userId: string,
): Promise<string | null> {
  const assignment = await prisma.userClienteAssignment.findFirst({
    where: { userId, isPrimary: true, active: true },
    select: { clienteId: true },
  });

  return assignment?.clienteId ?? null;
}

/**
 * Check if user has access to a specific Cliente
 */
export async function userHasAccessToCliente(
  userId: string,
  clienteId: string,
): Promise<boolean> {
  const assignment = await prisma.userClienteAssignment.findUnique({
    where: {
      userId_clienteId: { userId, clienteId },
    },
  });

  return assignment?.active ?? false;
}

/**
 * Assign user to a Cliente
 */
export async function assignUserToCliente(
  userId: string,
  clienteId: string,
  isPrimary = false,
) {
  // If setting as primary, unset other primary assignments
  if (isPrimary) {
    await prisma.userClienteAssignment.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return await prisma.userClienteAssignment.upsert({
    where: {
      userId_clienteId: { userId, clienteId },
    },
    update: { isPrimary, active: true },
    create: { userId, clienteId, isPrimary },
  });
}

/**
 * Remove user from a Cliente (soft delete)
 */
export async function removeUserFromCliente(userId: string, clienteId: string) {
  return await prisma.userClienteAssignment.update({
    where: {
      userId_clienteId: { userId, clienteId },
    },
    data: { active: false },
  });
}

/**
 * Set a Cliente as the user's primary Cliente
 */
export async function setPrimaryCliente(userId: string, clienteId: string) {
  // Verify the assignment exists and is active
  const assignment = await prisma.userClienteAssignment.findUnique({
    where: {
      userId_clienteId: { userId, clienteId },
    },
  });

  if (!assignment || !assignment.active) {
    throw new Error("User is not assigned to this Cliente");
  }

  // Unset all other primary assignments
  await prisma.userClienteAssignment.updateMany({
    where: { userId, isPrimary: true },
    data: { isPrimary: false },
  });

  // Set this one as primary
  return await prisma.userClienteAssignment.update({
    where: {
      userId_clienteId: { userId, clienteId },
    },
    data: { isPrimary: true },
  });
}

/**
 * Get all users assigned to a Cliente
 */
export async function getClienteUsers(clienteId: string) {
  const assignments = await prisma.userClienteAssignment.findMany({
    where: { clienteId, active: true },
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
 * Migrate existing clienteId to clienteAssignments
 * Run this once after deploying the new schema
 */
export async function migrateClienteAssignments() {
  const users = await prisma.user.findMany({
    where: { clienteId: { not: null } },
    select: { id: true, clienteId: true },
  });

  let migrated = 0;

  for (const user of users) {
    if (!user.clienteId) continue;

    // Check if assignment already exists
    const existing = await prisma.userClienteAssignment.findUnique({
      where: {
        userId_clienteId: { userId: user.id, clienteId: user.clienteId },
      },
    });

    if (!existing) {
      await prisma.userClienteAssignment.create({
        data: {
          userId: user.id,
          clienteId: user.clienteId,
          isPrimary: true, // Existing clienteId becomes primary
        },
      });
      migrated++;
    }
  }

  console.log(`Migrated ${migrated} user Cliente assignments`);
  return migrated;
}
