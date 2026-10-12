import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("./prisma.singleton", () => ({
  prisma: { $transaction: transaction },
}));

import { serializableTransaction } from "./serializable-transaction";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("serializableTransaction", () => {
  it("returns the committed result with serializable isolation and bounded timeouts", async () => {
    const tx = { attempt: 1 };
    const operation = vi.fn(async () => "committed");
    transaction.mockImplementation(async (run) => run(tx));
    expect(await serializableTransaction(operation)).toBe("committed");
    expect(operation).toHaveBeenCalledWith(tx);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(operation, {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 15000,
    });
  });

  it("retries commit-time P2034 conflicts with delays and returns only the fourth attempt", async () => {
    const conflict = { code: "P2034" };
    let attempt = 0;
    const operation = vi.fn(async (tx) => tx.attempt);
    transaction.mockImplementation(async (run) => {
      const result = await run({ attempt: ++attempt });
      if (attempt < 4) throw conflict;
      return result;
    });
    const pending = serializableTransaction(operation);
    await vi.advanceTimersByTimeAsync(0);
    expect(operation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(24);
    expect(transaction).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(49);
    expect(transaction).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(99);
    expect(transaction).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe(4);
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it("propagates the fourth conflict without scheduling a fifth attempt", async () => {
    const conflict = { code: "P2034" };
    transaction.mockRejectedValue(conflict);
    const rejected = expect(
      serializableTransaction(async () => "unused"),
    ).rejects.toBe(conflict);
    await vi.runAllTimersAsync();
    await rejected;
    expect(transaction).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { code: "P2002" },
    { code: "P2028" },
    new Error("connection lost"),
    null,
    "P2034",
  ])("does not retry non-serialization failures (%j)", async (error) => {
    transaction.mockRejectedValue(error);
    await expect(serializableTransaction(async () => "unused")).rejects.toBe(
      error,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
