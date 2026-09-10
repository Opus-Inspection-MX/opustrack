import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";

/**
 * Deferred notifications: dispatch only on commit.
 *
 * A notification fired inside a `prisma.$transaction` must not go out when
 * the transaction rolls back — otherwise the operator gets an alert about
 * work that never happened. `withDeferredNotifications(fn)` opens a
 * collector: everything recorded with `deferAfterCommit` while `fn` runs is
 * dispatched after `fn` resolves (the commit path). When `fn` throws, the
 * collector is discarded and nothing is dispatched.
 *
 * Calls with no collector open (code outside a wrapped transaction) dispatch
 * immediately, so the ~16 `syncIncidentState` call sites never pass
 * `before/after` around by hand: `sync` records its transition and this
 * module decides when it is safe to send.
 *
 * Nesting is safe: an inner `withDeferredNotifications` joins the outer
 * collector instead of opening its own, so a helper with its own transaction
 * (e.g. `ensureFsrsAssignedToIncident`) called from inside an already-wrapped
 * flow still dispatches exactly once, on the outer commit.
 *
 * Flushing never throws: dispatch already swallows its own failures, and each
 * task is additionally guarded so one bad task cannot starve the rest — a
 * notification problem must never surface as a business-operation failure.
 */

/** A notification send, evaluated lazily at flush time (post-commit). */
export type DeferredTask = () => Promise<void>;

const storage = new AsyncLocalStorage<DeferredTask[]>();

/**
 * Record a notification for later dispatch, or dispatch it now when no
 * collector is open. Never throws.
 */
export function deferAfterCommit(task: DeferredTask): void {
  const collector = storage.getStore();
  if (!collector) {
    void task().catch((error: unknown) => {
      logger.error("[after-commit] Error dispatching notification:", error);
    });
    return;
  }
  collector.push(task);
}

/**
 * Run `fn` with a notification collector open. When `fn` resolves, every
 * recorded task is dispatched in order; when `fn` rejects (rollback), the
 * collector is dropped in silence.
 */
export async function withDeferredNotifications<T>(
  fn: () => Promise<T>,
): Promise<T> {
  if (storage.getStore()) return fn();
  const collector: DeferredTask[] = [];
  const result = await storage.run(collector, fn);
  for (const task of collector) {
    try {
      await task();
    } catch (error) {
      logger.error("[after-commit] Error flushing notification:", error);
    }
  }
  return result;
}

type InteractiveTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * `prisma.$transaction` with the notification collector open: transitions
 * recorded by `syncIncidentState` inside `fn` dispatch only when the
 * transaction commits. A drop-in replacement at the call site — same
 * indentation, same closing — so wrapping a flow never reformats its body.
 */
export function transactionWithNotifications<T>(
  fn: (tx: InteractiveTx) => Promise<T>,
): Promise<T> {
  return withDeferredNotifications(() => prisma.$transaction(fn));
}
