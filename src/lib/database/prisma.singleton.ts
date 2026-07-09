import { type Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Query logging is expensive in dev (every SQL statement is serialized to
// stdout). Default dev to error/warn only; opt into full query logging with
// PRISMA_LOG_QUERIES=true when you actually need to inspect queries.
const logLevels: Prisma.LogLevel[] =
  process.env.NODE_ENV === "development"
    ? process.env.PRISMA_LOG_QUERIES === "true"
      ? ["query", "error", "warn"]
      : ["error", "warn"]
    : ["error"];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
