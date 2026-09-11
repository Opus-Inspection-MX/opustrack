import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The notification bell's polling contract (Fase 6a).
 *
 * The bell used to fetch the full 20-notification list every 10 s even with
 * the tab hidden. Now `useNotificationFeed` polls a cheap signature
 * (`unreadCount` + latest id) every 30 s, visible-tab only, and reloads the
 * list only when the signature moves. Same fake-timer style as
 * `use-live-refresh.test.tsx`.
 */

import {
  canShowBrowserNotifications,
  showBrowserNotification,
} from "@/lib/notifications/browser-notifications";
import { useNotificationFeed } from "./use-notification-feed";

vi.mock("@/lib/notifications/browser-notifications", () => ({
  canShowBrowserNotifications: vi.fn(() => true),
  showBrowserNotification: vi.fn(),
  requestNotificationPermission: vi.fn(),
}));

const INTERVAL = 1000;

interface FeedRow {
  id: string;
  title: string;
  message: string;
  type: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: Date;
  priority: number;
}

function row(id: string, overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id,
    title: `Title ${id}`,
    message: `Message ${id}`,
    type: "info",
    actionUrl: null,
    isRead: false,
    createdAt: new Date(),
    priority: 1,
    ...overrides,
  };
}

/** Drives `document.visibilityState`, which jsdom exposes as a plain getter. */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function Probe({
  initialNotifications = [],
  initialUnreadCount = 0,
}: {
  initialNotifications?: FeedRow[];
  initialUnreadCount?: number;
}) {
  const feed = useNotificationFeed({
    initialNotifications,
    initialUnreadCount,
    intervalMs: INTERVAL,
  });
  return (
    <div
      data-testid="feed-state"
      data-count={feed.unreadCount}
      data-ids={feed.notifications.map((n) => n.id).join(",")}
      data-loading={String(feed.isLoading)}
    />
  );
}

/** Advance timers and let the awaited fetches settle. */
async function tick(times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      vi.advanceTimersByTime(INTERVAL);
    });
  }
  await act(async () => {});
}

function fullFetches(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    ([url]) =>
      typeof url === "string" &&
      url === "/api/notifications" &&
      !(url as string).includes("signature"),
  );
}

function signatureFetches(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    ([url]) =>
      typeof url === "string" && url.includes("/api/notifications?signature="),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
let signature = "s1";
let fullList: FeedRow[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
  vi.clearAllMocks();
  signature = "s1";
  fullList = [];

  fetchMock = vi.fn(async (url: string) => {
    if (typeof url === "string" && url.includes("signature=")) {
      return { ok: true, json: async () => ({ signature }) };
    }
    return {
      ok: true,
      json: async () => ({
        notifications: fullList,
        unreadCount: fullList.filter((n) => !n.isRead).length,
      }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useNotificationFeed", () => {
  it("no pide nada mientras la pestaña está en segundo plano", async () => {
    render(<Probe />);
    await act(async () => {});
    const atMount = fetchMock.mock.calls.length;
    expect(atMount).toBeGreaterThan(0);

    fetchMock.mockClear();
    setVisibility("hidden");
    await tick(5);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("la lista completa solo se pide si la firma cambia", async () => {
    render(<Probe />);
    await act(async () => {});
    expect(fullFetches(fetchMock)).toHaveLength(1);

    await tick(3);
    expect(fullFetches(fetchMock)).toHaveLength(1);
    expect(signatureFetches(fetchMock).length).toBeGreaterThan(1);

    signature = "s2";
    fullList = [row("n1")];
    await tick(1);
    expect(fullFetches(fetchMock)).toHaveLength(2);

    const state = screen.getByTestId("feed-state");
    expect(state.getAttribute("data-ids")).toBe("n1");
    expect(state.getAttribute("data-count")).toBe("1");
  });

  it("la primera carga no dispara notificaciones del navegador; las nuevas sí", async () => {
    fullList = [row("n1")];
    render(<Probe />);
    await act(async () => {});

    expect(showBrowserNotification).not.toHaveBeenCalled();

    signature = "s2";
    fullList = [row("n1"), row("n2"), row("n3", { isRead: true })];
    await tick(1);

    expect(showBrowserNotification).toHaveBeenCalledTimes(1);
    expect(showBrowserNotification).toHaveBeenCalledWith(
      "Title n2",
      expect.objectContaining({ body: "Message n2", tag: "n2" }),
    );
  });

  it("respeta el permiso de notificaciones del navegador", async () => {
    vi.mocked(canShowBrowserNotifications).mockReturnValue(false);
    fullList = [row("n1")];
    render(<Probe />);
    await act(async () => {});

    signature = "s2";
    fullList = [row("n1"), row("n2")];
    await tick(1);

    expect(showBrowserNotification).not.toHaveBeenCalled();
  });

  it("los errores de firma entran en backoff en vez de martillar", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("signature=")) {
        throw new Error("red caída");
      }
      return {
        ok: true,
        json: async () => ({ notifications: [], unreadCount: 0 }),
      };
    });

    render(<Probe />);
    await act(async () => {});
    // t=0: initial full fetch + signature attempt #1 (fails → wait 1000).
    // t=1000: attempt #2 (fails → wait 2000 → skip t=2000).
    // t=3000: attempt #3 (fails → wait 4000 → skip t=4000,5000,6000).
    // t=7000: attempt #4.
    await tick(7);

    expect(signatureFetches(fetchMock)).toHaveLength(4);
  });
});
