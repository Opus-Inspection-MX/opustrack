import { type Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientWithOmit | undefined;
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

function createPrismaClient() {
  return new PrismaClient({
    log: logLevels,
    // H-01: the password hash must never reach a Server Action response.
    // Every `include` over User (or `user: true`) used to drag the hash to
    // the browser. This global omit strips it from all reads, including
    // nested relations; explicit `select: { password: true }` still works
    // for the two legitimate uses (login, password change).
    omit: { user: { password: true } },
  });
}

type PrismaClientWithOmit = ReturnType<typeof createPrismaClient>;

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
