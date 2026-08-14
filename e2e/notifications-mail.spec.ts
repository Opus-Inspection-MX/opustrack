import { expect, test } from "@playwright/test";
import { authFile } from "./fixtures/auth";
import { db, uniqueSuffix } from "./fixtures/db";
import { fillFieldById } from "./fixtures/forms";
import {
  clearMailbox,
  expectNoMessageFor,
  waitForMessage,
} from "./fixtures/mail";

/**
 * Email delivery, proven against a real SMTP server.
 *
 * Mailpit runs beside the throwaway database and the app talks to it exactly as
 * it would to a corporate mail server, so these assertions cover the transport
 * too — not just that some function was called.
 *
 * The negative assertions carry as much weight as the positive ones: the whole
 * reason the audiences were split is that a single shared "admins" list mailed
 * vacation requests to the operations administrators, who cannot approve them,
 * while the approvers heard nothing at all.
 */

test.describe.configure({ mode: "serial" });

const SUFFIX = uniqueSuffix();
const OPS_EMAIL = `e2e.ops.${SUFFIX}@opusinspection.com`;
const VAC_EMAIL = `e2e.vac.${SUFFIX}@opusinspection.com`;
const INCIDENT_TITLE = `E2E Correo ${SUFFIX}`;

/** An account holding exactly one role, so the audience under test is isolated. */
async function createUserWithRole(email: string, roleName: string) {
  const [role, status] = await Promise.all([
    db().role.findUniqueOrThrow({ where: { name: roleName } }),
    db().userStatus.findFirstOrThrow({ where: { name: "ACTIVO" } }),
  ]);
  const { hashPassword } = await import("../src/lib/security/hash");

  await db().user.create({
    data: {
      email,
      name: `E2E ${roleName} ${SUFFIX}`,
      password: await hashPassword("Correo123!"),
      userStatusId: status.id,
      userRoles: { create: [{ roleId: role.id }] },
    },
  });
}

/**
 * Monday to Wednesday of next week, as the date input wants them.
 *
 * Weekdays because a range with no business day is refused outright, and next
 * week because it falls inside the accrual window of the period below.
 */
function nextWeekRange(): { start: string; end: string } {
  const monday = new Date();
  monday.setDate(monday.getDate() + 7);
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7));
  const wednesday = new Date(monday);
  wednesday.setDate(wednesday.getDate() + 2);

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return { start: iso(monday), end: iso(wednesday) };
}

test.beforeAll(async () => {
  await createUserWithRole(OPS_EMAIL, "ADMIN_OPERACION");
  await createUserWithRole(VAC_EMAIL, "ADMIN_VACACIONES");

  // The shared e2e FSR is provisioned without a hire date, and without one
  // there is no vacation period to charge, so the request is refused before a
  // single mail is sent. Hired a year ago: period 1 is fully accrued and its
  // grace window still covers next week.
  const hire = new Date();
  hire.setFullYear(hire.getFullYear() - 1);
  await db().user.updateMany({
    where: { email: process.env.E2E_FSR_EMAIL },
    data: { hireDate: hire },
  });
});

test.describe("incidencias", () => {
  test.use({ storageState: authFile("client") });

  test("una incidencia nueva le llega por correo al admin de operación", async ({
    page,
  }) => {
    await clearMailbox();

    await page.goto("/client/new");
    await fillFieldById(page, "title", INCIDENT_TITLE);
    await fillFieldById(
      page,
      "description",
      "Incidente creado por la suite de correo.",
    );
    await page.getByText("Selecciona el tipo de incidente").click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Enviar Reporte" }).click();
    await page.waitForURL("**/client");

    const message = await waitForMessage({
      to: OPS_EMAIL,
      subject: /Nuevo incidente/,
    });
    expect(message.Subject).toContain(INCIDENT_TITLE);

    // And NOT to the vacation administrator, who can do nothing about it.
    await expectNoMessageFor(VAC_EMAIL);
  });
});

test.describe("vacaciones", () => {
  test.use({ storageState: authFile("fsr") });

  test("una solicitud le llega al admin de VACACIONES, no al de operación", async ({
    page,
  }) => {
    await clearMailbox();

    // Through the real form: importing the notification helper here would run
    // it in the TEST process, proving nothing about the server that actually
    // has to send the mail.
    const range = nextWeekRange();
    await page.goto("/vacations/new");
    await fillFieldById(page, "startDate", range.start);
    await fillFieldById(page, "endDate", range.end);
    await page.getByRole("button", { name: "Enviar Solicitud" }).click();
    // Redirect back to the list is what proves the request was accepted; a
    // refused rule keeps the form on screen with a toast.
    await page.waitForURL("**/vacations");

    const requester = await db().user.findFirstOrThrow({
      where: { email: process.env.E2E_FSR_EMAIL },
      select: { name: true },
    });

    const message = await waitForMessage({
      to: VAC_EMAIL,
      subject: /Solicitud de vacaciones/,
    });
    expect(message.Subject).toContain(requester.name);

    // The regression that motivated splitting the audiences.
    await expectNoMessageFor(OPS_EMAIL);
  });
});
