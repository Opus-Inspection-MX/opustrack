import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/actions/result";
import type {
  FsrAvailabilityData,
  FsrAvailabilityRequest,
} from "@/lib/assignments/fsr-availability";

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("@/lib/actions/assignment-availability", () => ({
  getAssignmentFsrAvailability: lookup,
}));

import { useFsrAvailability } from "./use-fsr-availability";

function deferred() {
  let resolve!: (result: ActionResult<FsrAvailabilityData>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ActionResult<FsrAvailabilityData>>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const request: FsrAvailabilityRequest = {
  incidentId: 1,
  assignmentId: "a1",
  scheduledDate: "2026-10-13",
};
const ready = (date: string | null, unavailable = false) => ({
  success: true as const,
  date,
  fsrs: [
    {
      userId: "f1",
      name: "Ana",
      unavailable,
      reason: unavailable ? ("APPROVED_ABSENCE" as const) : null,
    },
  ],
});
beforeEach(() => vi.resetAllMocks());

describe("FSR availability query identity", () => {
  it("invalidates ready immediately and ignores reversed date responses", async () => {
    const old = deferred();
    const current = deferred();
    lookup
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise)
      .mockReturnValue(deferred().promise);
    const { result, rerender } = renderHook(
      ({ query }) => useFsrAvailability(query),
      { initialProps: { query: request } },
    );
    expect(result.current.state).toBe("loading");
    rerender({ query: { ...request, scheduledDate: "2026-10-14" } });
    await act(async () => current.resolve(ready("2026-10-14", true)));
    expect(result.current.fsrs[0].unavailable).toBe(true);
    await act(async () => old.resolve(ready(request.scheduledDate)));
    expect(result.current.fsrs[0].unavailable).toBe(true);
    rerender({ query: { ...request, scheduledDate: "2026-10-15" } });
    expect(result.current.state).toBe("loading");
    expect(result.current.fsrs).toEqual([]);
  });
  it.each(["incident", "assignment", "closed editor"])(
    "ignores an obsolete %s lookup",
    async (change) => {
      const old = deferred();
      const current = deferred();
      lookup
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(current.promise);
      const { result, rerender } = renderHook(
        ({ query, open }) => useFsrAvailability(query, open),
        { initialProps: { query: request, open: true } },
      );
      rerender({
        query:
          change === "incident"
            ? { ...request, incidentId: 2 }
            : change === "assignment"
              ? { ...request, assignmentId: "a2" }
              : request,
        open: change !== "closed editor",
      });
      await act(async () => old.resolve(ready(request.scheduledDate, true)));
      expect(result.current.state).toBe(
        change === "closed editor" ? "idle" : "loading",
      );
      expect(result.current.fsrs).toEqual([]);
      if (change === "closed editor") {
        rerender({ query: request, open: true });
        expect(result.current.state).toBe("loading");
      }
      await act(async () => current.resolve(ready(request.scheduledDate)));
      expect(result.current.state).toBe("ready");
    },
  );
  it("ignores completion after unmount", async () => {
    const pending = deferred();
    lookup.mockReturnValue(pending.promise);
    const { unmount } = renderHook(() => useFsrAvailability(request));
    unmount();
    await act(async () => pending.resolve(ready(request.scheduledDate)));
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it.each(["business", "transport"])(
    "shows %s failure and retries without stale ready data",
    async (kind) => {
      if (kind === "business")
        lookup.mockResolvedValueOnce({ success: false, error: "Sin acceso" });
      else lookup.mockRejectedValueOnce(new Error("network"));
      lookup.mockResolvedValueOnce(ready(request.scheduledDate));
      const { result } = renderHook(() => useFsrAvailability(request));
      await waitFor(() => expect(result.current.state).toBe("error"));
      expect(result.current.fsrs).toEqual([]);
      act(() => result.current.retry());
      expect(result.current.state).toBe("loading");
      await waitFor(() => expect(result.current.state).toBe("ready"));
      expect(lookup).toHaveBeenCalledTimes(2);
    },
  );
  it("preserves null-date deferred semantics through the scoped action", async () => {
    lookup.mockResolvedValue(ready(null));
    const { result } = renderHook(() =>
      useFsrAvailability({ ...request, scheduledDate: null }),
    );
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(lookup).toHaveBeenCalledWith({ ...request, scheduledDate: null });
    expect(result.current.fsrs[0].unavailable).toBe(false);
  });
});
