import { beforeAll, describe, expect, it, vi } from "vitest";
import { startVehicleTrip } from "@/lib/actions/vehicle-trips";
import { prisma } from "@/lib/database/prisma.singleton";
import { retryDueEmails } from "@/lib/mail/outbox";
import type { MailTransport } from "@/lib/mail/transport";
import { MATRIX_CONCURRENCY } from "./coverage";
import { createWorld, type IntWorld } from "./fixtures";
import { actAs } from "./session-state";

/**
 * Concurrency suite (Fase 5 hook).
 *
 * Two parallel `retryDueEmails` must send each mail once, and two parallel
 * `startVehicleTrip` with the same idempotency key must create one trip.
 * Neither claim exists on main yet, so both cases are `it.fails` with
 * TODO(5a) — the suite pins the desired behavior without implementing it.
 */

vi.mock("@/lib/mail/transport", () => {
  const sentSubjects: string[] = [];
  const counting: MailTransport = {
    name: "counting-test",
    async send(message) {
      sentSubjects.push(message.subject);
      // Widen the race window: both runners must observe PENDIENTE.
      await new Promise((resolve) => setTimeout(resolve, 25));
      return "test-message-id";
    },
    async verify() {},
  };
  return {
    getMailTransport: () => counting,
    resetMailTransport: () => {},
    noopTransport: counting,
    __sentSubjects: sentSubjects,
  };
});

vi.mock("@/lib/storage/file-storage", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/storage/file-storage")>();
  return {
    ...original,
    uploadFileFromBuffer: async () => ({
      url: "test://conc/odo.jpg",
      filename: "odo.jpg",
      size: 100,
      mimetype: "image/jpeg",
      provider: "test",
    }),
  };
});

const COVERED = new Set([
  "mail/outbox.ts :: retryDueEmails",
  "vehicle-trips.ts :: startVehicleTrip",
]);

let world: IntWorld;

beforeAll(async () => {
  world = await createWorld("conc");
});

describe("concurrency registration", () => {
  it("registers every MATRIX_CONCURRENCY action in this file", () => {
    const missing = [...MATRIX_CONCURRENCY].filter((key) => !COVERED.has(key));
    expect(missing, "MATRIX_CONCURRENCY entries without a case here").toEqual(
      [],
    );
  });
});

describe("mail outbox", () => {
  // TODO(5a/H-12): no ENVIANDO claim — both runners pick the same PENDIENTE
  // rows and send them twice.
  it.fails("two parallel retryDueEmails send each mail once", async () => {
    const subjects = ["int-conc mail 1", "int-conc mail 2"];
    for (const subject of subjects) {
      await prisma.emailOutbox.create({
        data: {
          notificationType: "int-conc",
          subject,
          text: subject,
          html: `<p>${subject}</p>`,
          recipients: ["int-conc@test.local"],
          status: "PENDIENTE",
        },
      });
    }
    const now = new Date();
    const [first, second] = await Promise.all([
      retryDueEmails(now),
      retryDueEmails(now),
    ]);
    expect(first.sent + second.sent).toBe(2);

    const { __sentSubjects } = (await import(
      "@/lib/mail/transport"
    )) as unknown as { __sentSubjects: string[] };
    const delivered = __sentSubjects.filter((subject) =>
      subjects.includes(subject),
    );
    expect(delivered).toHaveLength(2);
  });
});

describe("vehicle trips", () => {
  function tripForm(vehicleId: string, key: string): FormData {
    const form = new FormData();
    form.set("vehicleId", vehicleId);
    form.set("startOdometer", "5000");
    form.set(
      "photo",
      new File([new Uint8Array(100)], "odo.jpg", { type: "image/jpeg" }),
    );
    form.set("idempotencyKey", key);
    return form;
  }

  // TODO(5a/H-13): check-then-write idempotency — both runners pass the
  // replay lookup before either claims the key, so two trips are created.
  it.fails("two parallel starts with one key create one trip", async () => {
    const available = await prisma.vehicleStatus.findUniqueOrThrow({
      where: { name: "AVAILABLE" },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        make: "Int",
        model: "V-C-conc",
        year: 2024,
        licensePlate: "INT-conc-VC",
        statusId: available.id,
        assignedFsrId: world.fsrA.id,
      },
      select: { id: true },
    });
    actAs(world.fsrA.id);
    const key = "int-conc-key-1";
    const [first, second] = await Promise.all([
      startVehicleTrip(tripForm(vehicle.id, key)),
      startVehicleTrip(tripForm(vehicle.id, key)),
    ]);
    expect(first).toMatchObject({ success: true });
    expect(second).toMatchObject({ success: true });
    const trips = await prisma.vehicleTrip.findMany({
      where: { vehicleId: vehicle.id, active: true },
      select: { id: true },
    });
    expect(trips).toHaveLength(1);
  });
});
