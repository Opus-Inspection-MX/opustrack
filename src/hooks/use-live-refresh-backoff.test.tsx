import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Opt-in error backoff for `useLiveRefresh` (Fase 6a).
 *
 * Same fake-timer style as `use-live-refresh.test.tsx`. Without backoff every
 * visible tick asks again; with `maxBackoffMs` consecutive signature failures
 * wait ~intervalMs·2ⁿ⁻¹ between attempts, capped at the given bound.
 */

import {
  LIVE_REFRESH_MAX_BACKOFF_MS,
  useLiveRefresh,
} from "./use-live-refresh";

const INTERVAL = 1000;

/** Drives `document.visibilityState`, which jsdom exposes as a plain getter. */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function Probe({
  signature,
  onChanged,
  maxBackoffMs,
}: {
  signature: () => Promise<string | null>;
  onChanged: () => void;
  maxBackoffMs?: number;
}) {
  useLiveRefresh({ signature, onChanged, intervalMs: INTERVAL, maxBackoffMs });
  return null;
}

/** Advance timers and let the awaited signature settle. */
async function tick(times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      vi.advanceTimersByTime(INTERVAL);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLiveRefresh · opt-in error backoff", () => {
  it("sin maxBackoffMs cada tick visible pregunta aunque la firma falle", async () => {
    const signature = vi.fn(async () => {
      throw new Error("red caída");
    });

    render(<Probe signature={signature} onChanged={vi.fn()} />);
    await act(async () => {});
    await tick(3);

    // Mount attempt plus one per tick: no backoff, same as before Fase 6a.
    expect(signature).toHaveBeenCalledTimes(4);
  });

  it("los fallos consecutivos espacian los intentos exponencialmente", async () => {
    const signature = vi.fn(async () => {
      throw new Error("red caída");
    });

    render(
      <Probe signature={signature} onChanged={vi.fn()} maxBackoffMs={5000} />,
    );
    await act(async () => {});
    // t=0: attempt #1 fails → wait 1000ms → no skip.
    // t=1000: attempt #2 fails → wait 2000ms → skip t=2000.
    // t=3000: attempt #3 fails → wait 4000ms → skip t=4000,5000,6000.
    // t=7000: attempt #4.
    await tick(7);

    expect(signature).toHaveBeenCalledTimes(4);
  });

  it("el backoff nunca supera el tope", async () => {
    const signature = vi.fn(async () => {
      throw new Error("red caída");
    });

    render(
      <Probe signature={signature} onChanged={vi.fn()} maxBackoffMs={2500} />,
    );
    await act(async () => {});
    // t=0: #1 fails → wait 1000 → skip 0.
    // t=1000: #2 fails → wait 2000 → skip 1 (t=2000).
    // t=3000: #3 fails → wait min(4000, 2500)=2500 → skip 2 (t=4000,5000).
    // t=6000: #4 fails → wait 2500 → skip 2 (t=7000,8000).
    // t=9000: #5.
    await tick(9);

    expect(signature).toHaveBeenCalledTimes(5);
  });

  it("un éxito resetea el backoff: el siguiente tick pregunta de inmediato", async () => {
    const signature = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValue("estable");

    const onChanged = vi.fn();
    render(
      <Probe signature={signature} onChanged={onChanged} maxBackoffMs={5000} />,
    );
    await act(async () => {});
    // t=0: #1 fails → wait 1000 → skip 0.
    // t=1000: #2 fails → wait 2000 → skip t=2000.
    // t=3000: #3 succeeds (first answer: recorded, no reload).
    await tick(3);
    expect(signature).toHaveBeenCalledTimes(3);
    expect(onChanged).not.toHaveBeenCalled();

    // Backoff reset: the very next tick asks again, and a stable signature
    // still reloads nothing.
    await tick(1);
    expect(signature).toHaveBeenCalledTimes(4);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("el tope por defecto es 5 minutos", () => {
    expect(LIVE_REFRESH_MAX_BACKOFF_MS).toBe(5 * 60_000);
  });
});
