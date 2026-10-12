import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startAssignmentWork, closeAssignment } = vi.hoisted(() => ({
  startAssignmentWork: vi.fn(),
  closeAssignment: vi.fn(),
}));
const { startVehicleTrip, endVehicleTrip } = vi.hoisted(() => ({
  startVehicleTrip: vi.fn(),
  endVehicleTrip: vi.fn(),
}));

vi.mock("@/lib/actions/assignments", () => ({
  startAssignmentWork: (...args: unknown[]) => startAssignmentWork(...args),
  closeAssignment: (...args: unknown[]) => closeAssignment(...args),
}));
vi.mock("@/lib/actions/vehicle-trips", () => ({
  startVehicleTrip: (...args: unknown[]) => startVehicleTrip(...args),
  endVehicleTrip: (...args: unknown[]) => endVehicleTrip(...args),
}));

import {
  describeEnqueueFailure,
  entryRequiresPhoto,
  entryToFormData,
  flushEntry,
  saveDraft,
  withEntryLock,
} from "./flush";
import type { OutboxEntry } from "./outbox";
import { loadEntries, removeEntry, takeStagedPhoto } from "./outbox";

/**
 * RF-260/RF-261 flush: frozen evidence re-sent verbatim through the
 * unchanged actions. GPS is data at flush time, never re-captured.
 */

function draft(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    key: "key-1",
    kind: "closeAssignment",
    fields: { assignmentId: "a1", latitude: "19.43", longitude: "-99.13" },
    capturedAt: "2026-09-10T10:00:00.000Z",
    attempts: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

afterEach(() => {
  for (const entry of loadEntries()) removeEntry(entry.key);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("offline flush", () => {
  it("re-sends frozen fields plus idempotencyKey and capturedAt", () => {
    const fd = entryToFormData(draft());
    expect(fd.get("assignmentId")).toBe("a1");
    expect(fd.get("latitude")).toBe("19.43");
    expect(fd.get("idempotencyKey")).toBe("key-1");
    expect(fd.get("capturedAt")).toBe("2026-09-10T10:00:00.000Z");
  });

  it("sends the staged photo as File, never base64", () => {
    const photo = new File(["bytes"], "odometro.jpg", {
      type: "image/jpeg",
    });
    const fd = entryToFormData(draft({ kind: "startVehicleTrip" }), photo);
    const sent = fd.get("photo");
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe("odometro.jpg");
  });

  it("only trip kinds require a photo blob", () => {
    expect(entryRequiresPhoto("startVehicleTrip")).toBe(true);
    expect(entryRequiresPhoto("endVehicleTrip")).toBe(true);
    expect(entryRequiresPhoto("startAssignmentWork")).toBe(false);
    expect(entryRequiresPhoto("closeAssignment")).toBe(false);
  });

  it("dispatches each kind to its unchanged server action", async () => {
    closeAssignment.mockResolvedValue({ success: true, data: { id: "a1" } });
    const result = await flushEntry(draft());
    expect(result).toEqual({ success: true, data: { id: "a1" } });
    const sent = closeAssignment.mock.calls[0][0] as FormData;
    expect(sent.get("idempotencyKey")).toBe("key-1");
  });

  it("propagates business-rule failures so the entry is kept", async () => {
    closeAssignment.mockResolvedValue({
      success: false,
      error: "La incidencia está cancelada. No se pueden hacer cambios.",
    });
    const result = await flushEntry(draft());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/cancelada/);
  });

  it("refuses trip flushes without a photo blob, without calling", async () => {
    const result = await flushEntry(draft({ kind: "endVehicleTrip" }));
    expect(result.success).toBe(false);
    expect(endVehicleTrip).not.toHaveBeenCalled();
    expect(startVehicleTrip).not.toHaveBeenCalled();
  });

  it("describes queue failures in Spanish", () => {
    expect(describeEnqueueFailure("cap-reached")).toMatch(/llena/);
    expect(describeEnqueueFailure("quota-exceeded")).toMatch(/lleno/);
  });

  it("saveDraft freezes action-time evidence", () => {
    const before = Date.now();
    const queued = saveDraft({
      kind: "startAssignmentWork",
      fields: { assignmentId: "a9" },
    });
    expect(queued.queued).toBe(true);
    if (queued.queued) {
      const [entry] = queued.entries;
      expect(entry.kind).toBe("startAssignmentWork");
      expect(Date.parse(entry.capturedAt)).toBeGreaterThanOrEqual(before);
      expect(entry.attempts).toBe(0);
    }
  });

  it("saveDraft keeps the capturing user on the entry", () => {
    const queued = saveDraft({
      kind: "closeAssignment",
      fields: { assignmentId: "a9" },
      userId: "fsr-a",
    });
    expect(queued.queued).toBe(true);
    if (queued.queued) {
      const [entry] = queued.entries.slice(-1);
      expect(entry.userId).toBe("fsr-a");
    }
  });

  it("saveDraft preserves caller identity across a later date and replays the original evidence", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T00:01:00.000Z"));
    const identity = {
      key: "first-online-attempt",
      capturedAt: "2026-10-12T23:59:59.000Z",
    };
    const photo = new File(["original evidence"], "odometer.jpg", {
      type: "image/jpeg",
    });
    const fields = {
      tripId: "trip-1",
      endOdometer: "1250",
      endLatitude: "19.43",
    };
    const queued = saveDraft({
      kind: "endVehicleTrip",
      fields,
      photo,
      userId: "fsr-1",
      identity,
    });
    expect(queued.queued).toBe(true);
    const [entry] = loadEntries();
    expect(entry).toMatchObject({
      ...identity,
      fields,
      userId: "fsr-1",
      attempts: 0,
      photoName: "odometer.jpg",
    });
    expect(takeStagedPhoto(identity.key)).toBe(photo);
    endVehicleTrip.mockResolvedValue({ success: true, data: { id: "trip-1" } });
    await flushEntry(entry, photo);
    const sent = endVehicleTrip.mock.calls[0][0] as FormData;
    expect(sent.get("idempotencyKey")).toBe(identity.key);
    expect(sent.get("capturedAt")).toBe(identity.capturedAt);
    expect(sent.get("endLatitude")).toBe("19.43");
    expect(sent.get("photo")).toBe(photo);
  });
});

/**
 * Fase 5b (H-13): cross-tab flush lock serializes concurrent flushes of the
 * same draft; without `navigator.locks` the run still executes (the
 * caller's in-tab in-flight set is the fallback guard).
 */
describe("withEntryLock", () => {
  it("runs directly when navigator.locks is unavailable", async () => {
    const run = vi.fn(async () => "ok");
    await expect(withEntryLock("key-1", run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
