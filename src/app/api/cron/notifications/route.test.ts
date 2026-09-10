import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { dispatchDueBroadcasts, retryDueEmails, sendReminders } = vi.hoisted(
  () => ({
    dispatchDueBroadcasts: vi.fn(),
    retryDueEmails: vi.fn(),
    sendReminders: vi.fn(),
  }),
);

vi.mock("@/lib/notifications/broadcast-dispatch", () => ({
  dispatchDueBroadcasts,
}));
vi.mock("@/lib/mail/outbox", () => ({ retryDueEmails }));
vi.mock("@/lib/notifications/vacation-reminders", () => ({
  sendVacationStartingSoonReminders: sendReminders,
}));

import { NextRequest } from "next/server";
import { GET } from "./route";

/**
 * The cron contract: bearer auth with zero leaks, every task runs exactly
 * once per authorized call, a failing task cannot starve the others, and the
 * response summarizes the counts. Task-level idempotency (atomic broadcast
 * claim, reminder dedupe, outbox attempts) lives in the callees — here only
 * the wiring and isolation are pinned.
 */

const SECRET = "test-cron-secret";
const PREVIOUS = process.env.CRON_SECRET;

afterAll(() => {
  if (PREVIOUS === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = PREVIOUS;
});

function requestWith(auth: string | null): NextRequest {
  return new NextRequest("http://localhost/api/cron/notifications", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  dispatchDueBroadcasts.mockResolvedValue([
    { broadcastId: "b1", claimed: true, delivered: 3 },
    { broadcastId: "b2", claimed: false, delivered: 0 },
  ]);
  retryDueEmails.mockResolvedValue({ attempted: 2, sent: 1, failed: 1 });
  sendReminders.mockResolvedValue({ checked: 4, sent: 3, skipped: 1 });
});

describe("cron de notificaciones", () => {
  it("401 sin encabezado de autorización", async () => {
    const res = await GET(requestWith(null));

    expect(res.status).toBe(401);
    expect(dispatchDueBroadcasts).not.toHaveBeenCalled();
  });

  it("401 con esquema o secreto incorrectos, sin filtrar el motivo", async () => {
    for (const auth of [
      "Bearer secreto-equivocado",
      "Basic abc123",
      "Bearer ",
      SECRET,
    ]) {
      const res = await GET(requestWith(auth));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    }
    expect(dispatchDueBroadcasts).not.toHaveBeenCalled();
  });

  it("401 cuando CRON_SECRET no está configurado", async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(requestWith(`Bearer ${SECRET}`));

    expect(res.status).toBe(401);
    expect(dispatchDueBroadcasts).not.toHaveBeenCalled();
  });

  it("con el secreto correcto corre cada tarea una vez y resume conteos", async () => {
    const res = await GET(requestWith(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(dispatchDueBroadcasts).toHaveBeenCalledTimes(1);
    expect(retryDueEmails).toHaveBeenCalledTimes(1);
    expect(sendReminders).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({
      broadcasts: { claimed: 1, delivered: 3 },
      emails: { attempted: 2, sent: 1, failed: 1 },
      vacationReminders: { checked: 4, sent: 3, skipped: 1 },
    });
  });

  it("una tarea fallida no bloquea a las demás ni tumba la corrida", async () => {
    dispatchDueBroadcasts.mockRejectedValue(new Error("db caída"));

    const res = await GET(requestWith(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(retryDueEmails).toHaveBeenCalledTimes(1);
    expect(sendReminders).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.broadcasts).toEqual({ claimed: 0, delivered: 0 });
    expect(body.emails).toEqual({ attempted: 2, sent: 1, failed: 1 });
  });

});
