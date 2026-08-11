/**
 * Guard for the npm scripts that touch the e2e database schema.
 *
 * `prisma migrate deploy` and the seed run before Playwright ever loads, so
 * they need their own check — otherwise a misconfigured environment could
 * migrate or seed a real database before anything had a chance to complain.
 */
import { assertEphemeralDatabase } from "../e2e/fixtures/ephemeral-db";

try {
  assertEphemeralDatabase(process.env.DATABASE_URL);
} catch (error) {
  console.error(`\n${(error as Error).message}\n`);
  process.exit(1);
}
