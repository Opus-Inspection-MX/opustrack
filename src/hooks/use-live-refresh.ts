"use client";

import { useEffect, useRef } from "react";

/** How often to ask "did anything change?" while the tab is in front. */
export const LIVE_REFRESH_INTERVAL_MS = 30_000;

interface UseLiveRefreshOptions {
  /**
   * Cheap question answered by the server: a short string that changes if and
   * only if the data behind the screen changed. Must NOT return the rows.
   */
  signature: () => Promise<string | null>;
  /** Reload the real data. Only called when the signature actually moved. */
  onChanged: () => void;
  intervalMs?: number;
  /** Suspend polling — e.g. while the first load is still running. */
  enabled?: boolean;
}

/**
 * Keep a board up to date without hammering the database.
 *
 * Three rules, all of them deliberate:
 *
 * 1. **Ask before reloading.** The tick fetches a signature (a count plus the
 *    newest `updatedAt`), not the rows. Reloading the full nested query every
 *    30 s for every operator with the screen open is a self-inflicted denial of
 *    service; asking a couple of aggregates is not.
 * 2. **Only while the tab is in front.** A background tab polls nothing. A
 *    forgotten tab open overnight costs zero queries.
 * 3. **Never overlap.** A slow answer does not stack up behind the next tick.
 *
 * The first signature is recorded, not acted on: arriving at a screen must not
 * immediately reload what it just rendered.
 */
export function useLiveRefresh({
  signature,
  onChanged,
  intervalMs = LIVE_REFRESH_INTERVAL_MS,
  enabled = true,
}: UseLiveRefreshOptions) {
  // Refs, not state: changing these must never re-render or restart the timer.
  const signatureRef = useRef(signature);
  const onChangedRef = useRef(onChanged);
  signatureRef.current = signature;
  onChangedRef.current = onChanged;

  const lastSeen = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled || inFlight.current) return;
      if (document.visibilityState !== "visible") return;

      inFlight.current = true;
      try {
        const next = await signatureRef.current();
        if (cancelled || next === null) return;

        const previous = lastSeen.current;
        lastSeen.current = next;
        // `previous === null` is the first answer: record it and stay put.
        if (previous !== null && previous !== next) {
          onChangedRef.current();
        }
      } catch {
        // A failed check is not worth a toast: the next tick tries again, and
        // the user still has the data already on screen.
      } finally {
        inFlight.current = false;
      }
    };

    // Coming back to the tab is the moment the answer matters most, so check
    // then instead of waiting out the rest of the interval.
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    const timer = setInterval(check, intervalMs);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);
}
