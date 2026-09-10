import moment from "moment-timezone";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_TZ } from "@/lib/utils/datetime";

const { prismaMock, dispatch } = vi.hoisted(() => ({
  prismaMock: {
    vacation: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
  },
  dispatch: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("./dispatch", () => ({ dispatch }));

import { NOTIFICATION_TYPES } from "./notification-types";
import {
  sendVacationStartingSoonReminders,
  tomorrowCdmxRange,
} from "./vacation-reminders";

/**
 * The Phase 5 cron calls `sendVacationStartingSoonReminders`: only APROBADA
 * vacations starting tomorrow (CDMX) notify the requester, an existing
 * reminder suppresses the repeat, and one bad row never blocks the batch.
 */

// 2026-03-10 09:00 in CDMX (UTC-6, no DST): tomorrow is 2026-03-11 CDMX.
const NOW = new Date("2026-03-10T15:00:00.000Z");

const DUE = [
  { id: "v1", userId: "u1" },
  { id: "v2", userId: "u2" },
];

beforeEach(() => {
  vi.clearAllMocks();
  dispatch.mockResolvedValue(undefined);
  prismaMock.vacation.findMany.mockResolvedValue(DUE);
  prismaMock.notification.findMany.mockResolvedValue([]);
});

describe("recordatorios de vacación próxima", () => {
  it("pide solo vacaciones APROBADA que empiezan mañana en CDMX", async () => {
    await sendVacationStartingSoonReminders(NOW);

    const where = prismaMock.vacation.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      active: true,
      status: { name: "APROBADA", active: true },
    });
    const expectedStart = moment(NOW)
      .tz(APP_TZ)
      .add(1, "day")
      .startOf("day")
      .toDate();
    const expectedEnd = moment(expectedStart).add(1, "day").toDate();
    expect(where.startDate).toEqual({ gte: expectedStart, lt: expectedEnd });

    const range = tomorrowCdmxRange(NOW);
    expect(range).toEqual({ start: expectedStart, end: expectedEnd });
  });

  it("recuerda al solicitante con la entidad de la vacación", async () => {
    const summary = await sendVacationStartingSoonReminders(NOW);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.VACATION_STARTING_SOON,
      expect.objectContaining({
        recipients: ["u1"],
        ctx: { vacationId: "v1" },
        entity: { type: "vacation", id: "v1" },
      }),
    );
    expect(summary).toEqual({ checked: 2, sent: 2, skipped: 0 });
  });

  it("no duplica: omite la vacación que ya tiene su recordatorio", async () => {
    prismaMock.notification.findMany.mockResolvedValue([{ entityId: "v1" }]);

    const summary = await sendVacationStartingSoonReminders(NOW);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      NOTIFICATION_TYPES.VACATION_STARTING_SOON,
      expect.objectContaining({ recipients: ["u2"] }),
    );
    expect(summary).toEqual({ checked: 2, sent: 1, skipped: 1 });
  });

  it("un despacho fallido no bloquea el resto del lote ni lanza", async () => {
    dispatch.mockRejectedValueOnce(new Error("boom"));

    const summary = await sendVacationStartingSoonReminders(NOW);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ checked: 2, sent: 1, skipped: 1 });
  });

  it("si la BD falla, regresa ceros sin lanzar", async () => {
    prismaMock.vacation.findMany.mockRejectedValue(new Error("db caída"));

    const summary = await sendVacationStartingSoonReminders(NOW);

    expect(dispatch).not.toHaveBeenCalled();
    expect(summary).toEqual({ checked: 0, sent: 0, skipped: 0 });
  });

  it("sin vacaciones vencidas no consulta recordatorios existentes", async () => {
    prismaMock.vacation.findMany.mockResolvedValue([]);

    const summary = await sendVacationStartingSoonReminders(NOW);

    expect(prismaMock.notification.findMany).not.toHaveBeenCalled();
    expect(summary).toEqual({ checked: 0, sent: 0, skipped: 0 });
  });
});
