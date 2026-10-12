import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.singleton";

/** Only retry database-only callbacks; external effects must run after commit. */
export async function serializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      });
    } catch (error) {
      if (
        attempt >= 3 ||
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "P2034"
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}
