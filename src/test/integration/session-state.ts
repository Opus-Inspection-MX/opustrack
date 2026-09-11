/**
 * Who the mocked `getServerSession` returns, for integration tests.
 *
 * Server actions resolve the caller through `getServerSession(authOptions)`
 * in `src/lib/auth/auth.ts`. There is no HTTP layer here, so instead of
 * logging in, tests call `actAs(userId)` and every subsequent action runs
 * as that user — same Prisma rows, same permission resolution, same scope
 * helpers as production. `actAs(null)` clears the session (unauthenticated).
 *
 * Everything else (authz cache aside, which is keyed per user) is resolved
 * from the real database on every call.
 */
let currentUserId: string | null = null;

export function actAs(userId: string | null): void {
  currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}
