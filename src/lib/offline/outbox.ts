/**
 * Offline outbox (RF-260, RF-261): draft-and-retry, NEVER full sync.
 *
 * Four field actions (`startAssignmentWork`, `closeAssignment`,
 * `startVehicleTrip`, `endVehicleTrip`) freeze their action-time evidence
 * (scalar payload + GPS + `capturedAt`) into one localStorage entry per
 * pending action. A later flush re-sends the FROZEN payload through the
 * UNCHANGED server action — offline delays delivery, it never bypasses
 * guards. There is deliberately no merge UI and no offline read cache.
 *
 * Photos are staged as in-memory `File` blobs (see `stagePhoto`), never as
 * base64 — the RF-259 no-base64 rule extends here. Blobs do not survive a
 * page reload; after a reload the draft keeps scalars + GPS and the UI asks
 * the operator to re-attach the photo before flushing.
 */

export type OfflineActionKind =
  | "startAssignmentWork"
  | "closeAssignment"
  | "startVehicleTrip"
  | "endVehicleTrip";

/**
 * One pending field action. `fields` holds the scalar FormData entries the
 * flush re-sends verbatim (GPS coordinates frozen at capture time live here
 * too); `photoName` records that a photo was staged so the UI can prompt for
 * re-attachment when the in-memory blob is gone.
 */
export interface OutboxEntry {
  /** Idempotency key, sent as `idempotencyKey` and deduped server-side. */
  key: string;
  kind: OfflineActionKind;
  fields: Record<string, string>;
  /** ISO timestamp of the field moment — never rewritten at flush time. */
  capturedAt: string;
  /** Flush attempts so far; >= BACKOFF schedule length means manual-only. */
  attempts: number;
  lastError?: string;
  /** Original staged photo filename (the blob itself lives in memory only). */
  photoName?: string;
}

export const OFFLINE_OUTBOX_KEY = "opustrack.offline.outbox.v1";

/** Max queued drafts; fuller queues need explicit user-confirmed eviction. */
export const OUTBOX_MAX_ENTRIES = 20;

/**
 * Bounded backoff: delay before attempt N (0-indexed). Past the end of the
 * schedule the entry waits for a manual "Reintentar" — retries never run
 * forever on their own.
 */
export const OUTBOX_BACKOFF_MS = [0, 30_000, 5 * 60_000] as const;

/** Server-enforced freshness window (hours); mirrored here for UI hints. */
export const OFFLINE_FRESHNESS_HOURS = 24;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): StorageLike | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

/** New random idempotency key for a draft. */
export function newOutboxKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 0xffffffff,
  ).toString(36)}`;
}

function readRaw(store: StorageLike | null): OutboxEntry[] {
  if (!store) return [];
  try {
    const raw = store.getItem(OFFLINE_OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OutboxEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as OutboxEntry).key === "string" &&
        typeof (e as OutboxEntry).kind === "string" &&
        typeof (e as OutboxEntry).capturedAt === "string" &&
        typeof (e as OutboxEntry).fields === "object",
    );
  } catch {
    return [];
  }
}

/** All pending drafts, newest last. Never throws (SSR / corrupt JSON safe). */
export function loadEntries(store?: StorageLike | null): OutboxEntry[] {
  return readRaw(store ?? defaultStore());
}

export type PersistResult = { ok: true } | { ok: false; quotaExceeded: true };

/** Persist the queue. A full quota is reported, never thrown. */
export function persistEntries(
  entries: OutboxEntry[],
  store?: StorageLike | null,
): PersistResult {
  const target = store ?? defaultStore();
  if (!target) return { ok: true };
  try {
    target.setItem(OFFLINE_OUTBOX_KEY, JSON.stringify(entries));
    return { ok: true };
  } catch {
    return { ok: false, quotaExceeded: true };
  }
}

export type EnqueueResult =
  | { entries: OutboxEntry[]; queued: true }
  | {
      entries: OutboxEntry[];
      queued: false;
      reason: "cap-reached";
    };

/**
 * Append a draft. At cap the draft is REFUSED (never silently evicted) so
 * the UI can ask the operator to confirm discarding the oldest entry first.
 */
export function enqueueEntry(
  entry: OutboxEntry,
  store?: StorageLike | null,
): EnqueueResult {
  const current = readRaw(store ?? defaultStore());
  if (current.length >= OUTBOX_MAX_ENTRIES) {
    return { entries: current, queued: false, reason: "cap-reached" };
  }
  const next = [...current, entry];
  persistEntries(next, store);
  return { entries: next, queued: true };
}

/** Remove a draft (explicit user discard, or successful flush). */
export function removeEntry(
  key: string,
  store?: StorageLike | null,
): OutboxEntry[] {
  const next = readRaw(store ?? defaultStore()).filter((e) => e.key !== key);
  persistEntries(next, store);
  clearStagedPhoto(key);
  return next;
}

/**
 * Drop the oldest draft. Call ONLY after explicit operator confirmation —
 * eviction is never silent.
 */
export function evictOldest(store?: StorageLike | null): OutboxEntry[] {
  const current = readRaw(store ?? defaultStore());
  const [, ...rest] = current;
  if (current.length > 0) clearStagedPhoto(current[0].key);
  persistEntries(rest, store);
  return rest;
}

/** Record a flush attempt (counter + last error shown in entry detail). */
export function recordAttempt(
  key: string,
  lastError: string,
  store?: StorageLike | null,
): OutboxEntry[] {
  const next = readRaw(store ?? defaultStore()).map((e) =>
    e.key === key ? { ...e, attempts: e.attempts + 1, lastError } : e,
  );
  persistEntries(next, store);
  return next;
}

/** Delay before attempt N (0-indexed); null means manual-only from here. */
export function delayForAttempt(attempts: number): number | null {
  if (attempts < 0) return OUTBOX_BACKOFF_MS[0];
  return attempts < OUTBOX_BACKOFF_MS.length
    ? OUTBOX_BACKOFF_MS[attempts]
    : null;
}

/** True once bounded backoff is exhausted — only manual retry from here. */
export function requiresManualRetry(attempts: number): boolean {
  return delayForAttempt(attempts) === null;
}

/** Client-side staleness hint (the server enforces the window for real). */
export function isStaleLocal(capturedAt: string, now = Date.now()): boolean {
  const at = Date.parse(capturedAt);
  if (!Number.isFinite(at)) return true;
  return now - at > OFFLINE_FRESHNESS_HOURS * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Staged photo blobs (in-memory only — never persisted, never base64).
// ---------------------------------------------------------------------------

const stagedPhotos = new Map<string, File>();

/** Hold the field photo for a draft so the flush can send it as `File`. */
export function stagePhoto(key: string, photo: File): void {
  stagedPhotos.set(key, photo);
}

/** The staged blob for a draft, if this page lifetime still holds it. */
export function takeStagedPhoto(key: string): File | undefined {
  return stagedPhotos.get(key);
}

export function clearStagedPhoto(key: string): void {
  stagedPhotos.delete(key);
}
