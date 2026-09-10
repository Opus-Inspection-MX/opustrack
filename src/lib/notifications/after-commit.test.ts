import { describe, expect, it, vi } from "vitest";
import { deferAfterCommit, withDeferredNotifications } from "./after-commit";

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
