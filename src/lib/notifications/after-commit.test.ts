import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: { $transaction: transaction },
}));

import {
  deferAfterCommit,
  transactionWithNotifications,
  withDeferredNotifications,
} from "./after-commit";

beforeEach(() => {
  transaction.mockReset();
});
afterEach(() => vi.useRealTimers());

/**
 * The commit gate: notifications recorded inside a wrapped flow go out only
 * when the flow succeeds. A rollback stays silent, and code outside any
 * wrapper keeps dispatching immediately.
 */

describe("withDeferredNotifications", () => {
  it("dispatches recorded tasks after the wrapped flow resolves", async () => {
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});

    const result = await withDeferredNotifications(async () => {
      deferAfterCommit(first);
      deferAfterCommit(second);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.invocationCallOrder[0]).toBeLessThan(
      second.mock.invocationCallOrder[0] as number,
    );
  });

  it("a rollback discards every recorded task in silence", async () => {
    const task = vi.fn(async () => {});

    await expect(
      withDeferredNotifications(async () => {
        deferAfterCommit(task);
        throw new Error("rollback simulado");
      }),
    ).rejects.toThrow("rollback simulado");
    expect(task).not.toHaveBeenCalled();
  });

  it("without a collector, dispatches immediately", async () => {
    const task = vi.fn(async () => {});
    deferAfterCommit(task);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("a nested wrapper joins the outer collector (single flush on outer commit)", async () => {
    const task = vi.fn(async () => {});

    await withDeferredNotifications(async () => {
      await withDeferredNotifications(async () => {
        deferAfterCommit(task);
      });
      // The inner wrapper resolved, but nothing flushes until the outer one.
      expect(task).not.toHaveBeenCalled();
    });

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("a nested rollback still discards the outer collector", async () => {
    const task = vi.fn(async () => {});

    await expect(
      withDeferredNotifications(async () => {
        deferAfterCommit(task);
        await withDeferredNotifications(async () => {
          throw new Error("fallo interno");
        });
      }),
    ).rejects.toThrow("fallo interno");
    expect(task).not.toHaveBeenCalled();
  });

  it("a failing task does not starve the rest of the flush", async () => {
    const bad = vi.fn(async () => {
      throw new Error("SMTP caído");
    });
    const good = vi.fn(async () => {});

    await withDeferredNotifications(async () => {
      deferAfterCommit(bad);
      deferAfterCommit(good);
    });

    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe("transactionWithNotifications commit gate", () => {
  it("does not dispatch between callback completion and successful commit", async () => {
    const task = vi.fn(async () => {});
    transaction.mockImplementation(async (run) => {
      const result = await run({});
      expect(task).not.toHaveBeenCalled();
      return result;
    });
    expect(
      await transactionWithNotifications(async () => {
        deferAfterCommit(task);
        return "committed";
      }),
    ).toBe("committed");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("discards notifications when commit fails after the callback succeeds", async () => {
    const task = vi.fn(async () => {});
    const failure = { code: "P2002" };
    transaction.mockImplementation(async (run) => {
      await run({});
      throw failure;
    });
    await expect(
      transactionWithNotifications(async () => {
        deferAfterCommit(task);
        return "uncommitted";
      }),
    ).rejects.toBe(failure);
    expect(task).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    "only flushes winning attempt events once (outer collector=%s)",
    async (nested) => {
      vi.useFakeTimers();
      const events: number[] = [];
      const notify = vi.fn(async (attempt: number) => {
        events.push(attempt);
      });
      const outerTask = vi.fn(async () => {});
      let attempt = 0;
      transaction.mockImplementation(async (run) => {
        attempt += 1;
        const result = await run({});
        expect(notify).not.toHaveBeenCalled();
        if (attempt < 3) throw { code: "P2034" };
        return result;
      });
      const runTransaction = () =>
        transactionWithNotifications(async () => {
          const current = attempt;
          deferAfterCommit(() => notify(current));
          await withDeferredNotifications(async () => {
            deferAfterCommit(() => notify(current * 10));
          });
          return current;
        });
      const pending = nested
        ? withDeferredNotifications(async () => {
            deferAfterCommit(outerTask);
            const result = await runTransaction();
            expect(notify).not.toHaveBeenCalled();
            expect(outerTask).not.toHaveBeenCalled();
            return result;
          })
        : runTransaction();
      await vi.runAllTimersAsync();
      expect(await pending).toBe(3);
      expect(transaction).toHaveBeenCalledTimes(3);
      expect(events).toEqual([3, 30]);
      expect(notify).toHaveBeenCalledTimes(2);
      expect(outerTask).toHaveBeenCalledTimes(nested ? 1 : 0);
    },
  );

  it("discards all four attempts when serialization never commits", async () => {
    vi.useFakeTimers();
    const task = vi.fn(async () => {});
    const conflict = { code: "P2034" };
    transaction.mockImplementation(async (run) => {
      await run({});
      throw conflict;
    });
    const rejected = expect(
      transactionWithNotifications(async () => {
        deferAfterCommit(task);
      }),
    ).rejects.toBe(conflict);
    await vi.runAllTimersAsync();
    await rejected;
    expect(transaction).toHaveBeenCalledTimes(4);
    expect(task).not.toHaveBeenCalled();
  });

  it("a caught inner transaction failure does not contaminate the outer collector", async () => {
    const failedTask = vi.fn(async () => {});
    const outerTask = vi.fn(async () => {});
    const failure = { code: "P2002" };
    transaction.mockImplementation(async (run) => {
      await run({});
      throw failure;
    });
    await withDeferredNotifications(async () => {
      deferAfterCommit(outerTask);
      await expect(
        transactionWithNotifications(async () => {
          deferAfterCommit(failedTask);
        }),
      ).rejects.toBe(failure);
      expect(outerTask).not.toHaveBeenCalled();
    });
    expect(outerTask).toHaveBeenCalledTimes(1);
    expect(failedTask).not.toHaveBeenCalled();
  });

  it("an outer rollback discards the nested transaction's committed events", async () => {
    const task = vi.fn(async () => {});
    transaction.mockImplementation(async (run) => run({}));
    await expect(
      withDeferredNotifications(async () => {
        await transactionWithNotifications(async () => {
          deferAfterCommit(task);
        });
        throw new Error("outer rollback");
      }),
    ).rejects.toThrow("outer rollback");
    expect(task).not.toHaveBeenCalled();
  });
});
