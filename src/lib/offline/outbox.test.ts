import { describe, expect, it, vi } from "vitest";
import {
  delayForAttempt,
  enqueueEntry,
  evictOldest,
  isStaleLocal,
  loadEntries,
  newOutboxKey,
  OUTBOX_BACKOFF_MS,
  OUTBOX_MAX_ENTRIES,
  type OutboxEntry,
  persistEntries,
  recordAttempt,
  removeEntry,
  type StorageLike,
  stagePhoto,
  takeStagedPhoto,
} from "./outbox";

/**
 * RF-260/RF-261 outbox: local draft persistence with bounded backoff and
 * caps. The store is the contract under test — pure functions over an
 * injected StorageLike, so no browser is needed.
 */

function memoryStore(): StorageLike & { dropNextWrite?: boolean } {
  const data = new Map<string, string>();
  const store: StorageLike & { dropNextWrite?: boolean } = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (store.dropNextWrite) {
        throw new Error("QuotaExceededError");
      }
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  return store;
}

function entry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    key: newOutboxKey(),
    kind: "closeAssignment",
    fields: { assignmentId: "a1", latitude: "19.43", longitude: "-99.13" },
    capturedAt: new Date().toISOString(),
    attempts: 0,
    ...overrides,
  };
}

describe("offline outbox", () => {
  it("round-trips drafts through persistence", () => {
    const store = memoryStore();
    const first = entry();
    const second = entry({ kind: "startVehicleTrip" });
    enqueueEntry(first, store);
    enqueueEntry(second, store);
    const loaded = loadEntries(store);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].key).toBe(first.key);
    expect(loaded[1].kind).toBe("startVehicleTrip");
    // GPS frozen at capture: payload survives verbatim.
    expect(loaded[0].fields.latitude).toBe("19.43");
  });

  it("ignores corrupt payloads instead of throwing", () => {
    const store = memoryStore();
    store.setItem("opustrack.offline.outbox.v1", "not-json{{{");
    expect(loadEntries(store)).toEqual([]);
  });

  it("schedules immediate, 30s, 5min, then manual-only", () => {
    expect(delayForAttempt(0)).toBe(OUTBOX_BACKOFF_MS[0]);
    expect(delayForAttempt(1)).toBe(30_000);
    expect(delayForAttempt(2)).toBe(5 * 60_000);
    expect(delayForAttempt(3)).toBeNull();
    expect(delayForAttempt(99)).toBeNull();
  });

  it("refuses new drafts at cap instead of silently evicting", () => {
    const store = memoryStore();
    for (let i = 0; i < OUTBOX_MAX_ENTRIES; i++) {
      const res = enqueueEntry(entry(), store);
      expect(res.queued).toBe(true);
    }
    const refused = enqueueEntry(entry(), store);
    expect(refused.queued).toBe(false);
    if (!refused.queued) expect(refused.reason).toBe("cap-reached");
    // Nothing lost: the capped queue is intact.
    expect(loadEntries(store)).toHaveLength(OUTBOX_MAX_ENTRIES);
  });

  it("evicts oldest only through the explicit path", () => {
    const store = memoryStore();
    const oldest = entry();
    enqueueEntry(oldest, store);
    enqueueEntry(entry(), store);
    const rest = evictOldest(store);
    expect(rest).toHaveLength(1);
    expect(rest.find((e) => e.key === oldest.key)).toBeUndefined();
  });

  it("reports quota-exceeded instead of throwing", () => {
    const store = memoryStore();
    store.dropNextWrite = true;
    const res = persistEntries([entry()], store);
    expect(res.ok).toBe(false);
  });

  it("counts attempts and keeps the last error for entry detail", () => {
    const store = memoryStore();
    const draft = entry();
    enqueueEntry(draft, store);
    recordAttempt(draft.key, "NetworkError", store);
    recordAttempt(draft.key, "NetworkError", store);
    const [loaded] = loadEntries(store);
    expect(loaded.attempts).toBe(2);
    expect(loaded.lastError).toBe("NetworkError");
  });

  it("removes a draft on discard or successful flush", () => {
    const store = memoryStore();
    const draft = entry();
    enqueueEntry(draft, store);
    enqueueEntry(entry(), store);
    const rest = removeEntry(draft.key, store);
    expect(rest).toHaveLength(1);
  });

  it("flags drafts older than 24h as stale (server enforces for real)", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const fresh = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isStaleLocal(old)).toBe(true);
    expect(isStaleLocal(fresh)).toBe(false);
    expect(isStaleLocal("not-a-date")).toBe(true);
  });

  it("stages photo blobs in memory without base64", () => {
    const key = newOutboxKey();
    const photo = new File(["bytes"], "odometro.jpg", {
      type: "image/jpeg",
    });
    stagePhoto(key, photo);
    expect(takeStagedPhoto(key)).toBe(photo);
  });

  it("generates unique idempotency keys", () => {
    const keys = new Set(Array.from({ length: 50 }, () => newOutboxKey()));
    expect(keys.size).toBe(50);
  });

  it("never touches the real localStorage when a store is injected", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    loadEntries(memoryStore());
    expect(getItem).not.toHaveBeenCalled();
    getItem.mockRestore();
  });
});

/**
 * Fase 5b (H-14): drafts belong to the user who captured them.
 *
 * On a shared device, FSR A's trip draft must not flush under FSR B's
 * session. Every entry carries its capturing `userId`; only own entries
 * are sent/shown, logout keeps the queue (no evidence lost), and the UI
 * tells the operator that foreign drafts are waiting on the device.
 */
import { countOtherUserEntries, entriesForUser } from "./outbox";

describe("offline outbox per-user ownership", () => {
  it("keeps the capturing userId on the entry", () => {
    const store = memoryStore();
    enqueueEntry(entry({ userId: "fsr-a" }), store);
    const [loaded] = loadEntries(store);
    expect(loaded.userId).toBe("fsr-a");
  });

  it("only shows own entries plus legacy ones without owner", () => {
    const own = entry({ userId: "fsr-a" });
    const foreign = entry({ userId: "fsr-b" });
    const legacy = entry();
    const visible = entriesForUser([own, foreign, legacy], "fsr-a");
    expect(visible.map((e) => e.key)).toEqual([own.key, legacy.key]);
  });

  it("without a session user everything stays visible (back-compat)", () => {
    const own = entry({ userId: "fsr-a" });
    expect(entriesForUser([own], undefined)).toEqual([own]);
  });

  it("counts foreign drafts for the device notice", () => {
    const mine = entry({ userId: "fsr-a" });
    const theirs = entry({ userId: "fsr-b" });
    const legacy = entry();
    expect(countOtherUserEntries([mine, theirs, legacy], "fsr-a")).toBe(1);
    expect(countOtherUserEntries([mine, theirs], undefined)).toBe(0);
  });

  it("logout keeps every entry (no evidence lost)", () => {
    const store = memoryStore();
    enqueueEntry(entry({ userId: "fsr-a" }), store);
    // Logout clears the session, never the queue: all rows survive.
    expect(loadEntries(store)).toHaveLength(1);
    // …but the next user only sees (and flushes) their own.
    expect(entriesForUser(loadEntries(store), "fsr-b")).toEqual([]);
    expect(countOtherUserEntries(loadEntries(store), "fsr-b")).toBe(1);
  });
});
