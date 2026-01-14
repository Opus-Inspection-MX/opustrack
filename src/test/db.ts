import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

// Use a separate test database
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL?.replace(/\/\w+$/, "/opustrack_test");

let prismaClient: PrismaClient | null = null;

/**
 * Get or create a Prisma client for testing
 */
export function getTestPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_URL,
        },
      },
      log: process.env.DEBUG ? ["query", "error", "warn"] : ["error"],
    });
  }
  return prismaClient;
}

/**
 * Reset the test database (run migrations)
 */
export async function resetTestDatabase() {
  if (!TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is not defined");
  }

  try {
    // Run migrations on test database
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "inherit",
    });
  } catch (error) {
    console.error("Failed to reset test database:", error);
    throw error;
  }
}

/**
 * Seed the test database with minimal required data
 */
export async function seedTestDatabase() {
  const prisma = getTestPrismaClient();

  try {
    // Create a test state first
    const testState = await prisma.state.upsert({
      where: { code: "TEST" },
      update: {},
      create: {
        name: "Test State",
        code: "TEST",
      },
    });

    // Create a test VIC
    const vic = await prisma.vehicleInspectionCenter.upsert({
      where: { id: "test-vic-id" },
      update: {},
      create: {
        id: "test-vic-id",
        name: "Test VIC",
        code: "TEST001",
        address: "Test Address",
        phone: "1234567890",
        email: "test@vic.com",
        stateId: testState.id,
      },
    });

    // Create test roles
    const adminRole = await prisma.role.upsert({
      where: { name: "ADMINISTRADOR" },
      update: {},
      create: {
        name: "ADMINISTRADOR",
        description: "Administrator",
        defaultPath: "/admin",
      },
    });

    const fsrRole = await prisma.role.upsert({
      where: { name: "FSR" },
      update: {},
      create: {
        name: "FSR",
        description: "Field Service Representative",
        defaultPath: "/fsr",
      },
    });

    const clientRole = await prisma.role.upsert({
      where: { name: "CLIENT" },
      update: {},
      create: {
        name: "CLIENT",
        description: "Client",
        defaultPath: "/client",
      },
    });

    // Create user status
    const activeStatus = await prisma.userStatus.upsert({
      where: { name: "ACTIVO" },
      update: {},
      create: {
        name: "ACTIVO",
      },
    });

    // Create test users
    await prisma.user.upsert({
      where: { email: "test-admin@test.com" },
      update: {},
      create: {
        email: "test-admin@test.com",
        name: "Test Admin",
        password:
          "$2a$10$K5JhHUMN.P5k.0HXpZbRs.Nq0QYpF5hU5rHJ3/XP5JhHUMN.P5k.0", // "password123"
        roleId: adminRole.id,
        userStatusId: activeStatus.id,
      },
    });

    await prisma.user.upsert({
      where: { email: "test-fsr@test.com" },
      update: {},
      create: {
        email: "test-fsr@test.com",
        name: "Test FSR",
        password:
          "$2a$10$K5JhHUMN.P5k.0HXpZbRs.Nq0QYpF5hU5rHJ3/XP5JhHUMN.P5k.0", // "password123"
        roleId: fsrRole.id,
        userStatusId: activeStatus.id,
        vicId: vic.id,
      },
    });

    await prisma.user.upsert({
      where: { email: "test-client@test.com" },
      update: {},
      create: {
        email: "test-client@test.com",
        name: "Test Client",
        password:
          "$2a$10$K5JhHUMN.P5k.0HXpZbRs.Nq0QYpF5hU5rHJ3/XP5JhHUMN.P5k.0", // "password123"
        roleId: clientRole.id,
        userStatusId: activeStatus.id,
        vicId: vic.id,
      },
    });

    return { vic, adminRole, fsrRole, clientRole, activeStatus };
  } catch (error) {
    console.error("Failed to seed test database:", error);
    throw error;
  }
}

/**
 * Clean up all test data
 */
export async function cleanupTestDatabase() {
  const prisma = getTestPrismaClient();

  try {
    // Delete in order of dependencies
    await prisma.workOrderAttachment.deleteMany();
    await prisma.workActivity.deleteMany();
    await prisma.workPart.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.incident.deleteMany();
    await prisma.vehicleTrip.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.line.deleteMany();
    await prisma.part.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.incidentType.deleteMany();
    await prisma.incidentStatus.deleteMany();
    await prisma.vehicleInspectionCenter.deleteMany();
    await prisma.state.deleteMany();
    await prisma.userStatus.deleteMany();
  } catch (error) {
    console.error("Failed to cleanup test database:", error);
    throw error;
  }
}

/**
 * Disconnect from the test database
 */
export async function disconnectTestDatabase() {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}
