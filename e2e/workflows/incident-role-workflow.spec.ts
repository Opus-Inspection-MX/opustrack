import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { formatMX } from "../../src/lib/utils/datetime";
import {
  db,
  expectAssignmentStatus,
  expectIncidentStatus,
} from "../fixtures/db";
import {
  comboboxByLabel,
  fillStable,
  fillStableAll,
  pickFromCombobox,
} from "../fixtures/forms";
import { gotoReady } from "../fixtures/navigation";
import {
  closeSessions,
  createAssignmentUi,
  createVacationUi,
  decideVacationUi,
  decodedImage,
  handoff,
  reportIncidentUi,
  roleSession,
  workflowImage,
} from "../fixtures/workflow-ui";
import { addCivilDays, test, type WorkflowWorld } from "../fixtures/workflows";

test.setTimeout(360_000);

async function programReportedIncident(
  page: Page,
  world: WorkflowWorld,
  incident: { id: number; title: string },
  info: TestInfo,
) {
  const title = `Workflow schedule ${world.namespace}`;
  await gotoReady(page, "/admin/schedules/new");
  await fillStableAll([
    [page.locator("#title"), title],
    [page.locator("#scheduledAt"), `${world.today}T00:00`],
    [page.locator("#endDate"), `${addCivilDays(world.today, 1)}T23:59`],
  ]);
  await pickFromCombobox(page, {
    trigger: comboboxByLabel(page, "Clientes"),
    searchPlaceholder: "Buscar Cliente...",
    search: world.client.code,
    option: `${world.client.code} — ${world.client.name}`,
    closeAfter: true,
  });
  await Promise.all([
    page.waitForURL(/\/admin\/schedules$/, { waitUntil: "domcontentloaded" }),
    page
      .getByRole("button", { name: "Crear Programación", exact: true })
      .click(),
  ]);
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Más acciones" }).click();
  await Promise.all([
    page.waitForURL(/\/admin\/schedules\/[^/]+$/, {
      waitUntil: "domcontentloaded",
    }),
    page.getByRole("menuitem", { name: "Ver", exact: true }).click(),
  ]);
  const id = page.url().split("/").at(-1) as string;
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  const schedule = await db().schedule.findUniqueOrThrow({
    where: { id },
    include: { clients: true },
  });
  expect(
    schedule.clients.filter((item) => item.active).map((item) => item.clientId),
  ).toEqual([world.client.id]);
  await Promise.all([
    page.waitForURL(new RegExp(`/admin/schedules/${id}/edit$`), {
      waitUntil: "domcontentloaded",
    }),
    page
      .getByRole("link", { name: "Editar Programación", exact: true })
      .click(),
  ]);
  await fillStable(
    page.locator("#endDate"),
    `${addCivilDays(world.today, 2)}T23:59`,
  );
  await page
    .getByRole("button", { name: "Guardar Cambios", exact: true })
    .click();
  await expect
    .poll(async () =>
      (
        await db().schedule.findUniqueOrThrow({ where: { id } })
      ).endDate?.toISOString(),
    )
    .toBe(`${addCivilDays(world.today, 3)}T05:59:00.000Z`);
  await handoff(page, info, "incident-operations-schedule-created-and-edited");
  // Link the already-reported incident through its editable programming field.
  await gotoReady(page, `/admin/incidents/${incident.id}/edit`);
  await expect(page.locator("#title")).toHaveValue(incident.title);
  await pickFromCombobox(page, {
    trigger: comboboxByLabel(page, "Programacion"),
    searchPlaceholder: "Buscar programacion...",
    search: formatMX(schedule.scheduledAt),
    option: formatMX(schedule.scheduledAt),
  });
  await page
    .getByRole("button", { name: "Actualizar Incidente", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await db().incident.findUniqueOrThrow({ where: { id: incident.id } }))
          .scheduleId,
    )
    .toBe(id);
  await gotoReady(page, `/admin/schedules/${id}`);
  const linked = page.getByRole("row").filter({ hasText: incident.title });
  await expect(linked).toHaveCount(1);
  await expect(linked.getByRole("link")).toHaveAttribute(
    "href",
    `/admin/incidents/${incident.id}`,
  );
  expect(
    await db().incident.count({ where: { clientId: world.client.id } }),
  ).toBe(1);
  await handoff(
    page,
    info,
    "incident-operations-schedule-linked-to-reporter-id",
  );
  return id;
}

async function startTripUi(
  page: Page,
  world: WorkflowWorld,
  index: number,
  assignment: { id: string; folio: number },
  title: string,
  info: TestInfo,
) {
  world.assertSameDay();
  const vehicle = world.vehicles[index];
  await gotoReady(page, "/fsr/vehicle-trips/start");
  await page.locator("#vehicle").click();
  await page
    .getByRole("option")
    .filter({ hasText: vehicle.licensePlate })
    .click();
  await page.locator("#assignment").click();
  await page
    .getByRole("option", {
      name: `AS-${assignment.folio} - ${title}`,
      exact: true,
    })
    .click();
  await fillStable(page.locator("#startOdometer"), String(1000 + index * 1000));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      workflowImage(
        `trip-${index}-start-${world.namespace}.png`,
        30 + index * 30,
      ),
    );
  await page.getByRole("button", { name: "Capturar GPS", exact: true }).click();
  await expect(page.getByText(/^Lat:/)).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/fsr\/vehicle-trips$/, { waitUntil: "domcontentloaded" }),
    page.getByRole("button", { name: "Iniciar Viaje", exact: true }).click(),
  ]);
  const link = page.getByRole("link").filter({ hasText: vehicle.licensePlate });
  await expect(link).toHaveCount(1);
  await expect(link).toContainText("En Progreso");
  const href = await link.getAttribute("href");
  expect(href).toMatch(/\/fsr\/vehicle-trips\/[^/]+\/end$/);
  const id = href?.split("/").at(-2) as string;
  const stored = await db().vehicleTrip.findUniqueOrThrow({
    where: { id },
    include: { status: true },
  });
  expect(stored).toMatchObject({
    vehicleId: vehicle.id,
    assignmentId: assignment.id,
    fsrId: index === 0 ? world.actors.fsrB.id : world.actors.fsrC.id,
  });
  expect(stored.status.code).toBe("EN_CURSO");
  expect(stored.startCapturedAt).not.toBeNull();
  await gotoReady(page, `/fsr/vehicle-trips/${id}`);
  await decodedImage(
    page.getByRole("img", {
      name: "Odómetro Inicial odometer reading",
      exact: true,
    }),
  );
  await handoff(
    page,
    info,
    `incident-fsr-${index}-assignment-linked-trip-start`,
  );
  return stored;
}

async function finishTripUi(
  page: Page,
  world: WorkflowWorld,
  id: string,
  index: number,
  info: TestInfo,
) {
  await gotoReady(page, `/fsr/vehicle-trips/${id}/end`);
  await fillStable(page.locator("#endOdometer"), String(1025 + index * 1000));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      workflowImage(
        `trip-${index}-end-${world.namespace}.png`,
        160 + index * 30,
      ),
    );
  await page.getByRole("button", { name: "Capturar GPS", exact: true }).click();
  await expect(page.getByText(/^Lat:/)).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/fsr\/vehicle-trips$/, { waitUntil: "domcontentloaded" }),
    page.getByRole("button", { name: "Finalizar Viaje", exact: true }).click(),
  ]);
  const link = page
    .getByRole("link")
    .filter({ hasText: world.vehicles[index].licensePlate });
  await expect(link).toContainText("Completado");
  await expect(link).toContainText("25 km");
  const detailUrl = new RegExp(`/fsr/vehicle-trips/${id}$`);
  await link.click();
  // Next.js App Router flake (router-cache class): after a server action +
  // router.push, clicking a cached link can fetch the RSC payload and then
  // silently abort the navigation — the URL never changes, for the operator
  // too. Probe bounded, then take the direct route to the same destination:
  // the contract under test is the rendered trip with its decoded photos,
  // not the router internals.
  try {
    await page.waitForURL(detailUrl, {
      timeout: 10_000,
      waitUntil: "domcontentloaded",
    });
  } catch {
    await gotoReady(page, `/fsr/vehicle-trips/${id}`);
  }
  await decodedImage(
    page.getByRole("img", {
      name: "Odómetro Inicial odometer reading",
      exact: true,
    }),
  );
  await decodedImage(
    page.getByRole("img", {
      name: "Odómetro Final odometer reading",
      exact: true,
    }),
  );
  const stored = await db().vehicleTrip.findUniqueOrThrow({
    where: { id },
    include: { status: true },
  });
  expect(stored.status.code).toBe("COMPLETADO");
  expect(stored.kmDriven).toBe(25);
  expect(stored.endOdometer).toBeGreaterThan(stored.startOdometer);
  expect(stored.endCapturedAt).not.toBeNull();
  expect(stored.endedAt).not.toBeNull();
  expect(stored.endLatitude).not.toBeNull();
  expect(stored.startPhotoUrl).not.toBe(stored.endPhotoUrl);
  await handoff(
    page,
    info,
    `incident-fsr-${index}-completed-trip-decoded-photos-gps`,
  );
  return stored;
}

test("incident reporter operations and independent FSRs close only after the last sibling", async ({
  browser,
  world,
}, info) => {
  // Six sequential synthetic logins plus ~60 authenticated UI steps across
  // six sessions exceed the file default on constrained hardware; the two
  // replacement journeys prove the same contracts in ~14s each, so this
  // budget covers duration, not an unbounded wait (every step keeps its own
  // assertion timeout). CI job budget (45 min) still fits.
  test.setTimeout(900_000);
  const sessions = [];
  try {
    const candidate = await roleSession(browser, world.actors.candidateA, info);
    sessions.push(candidate);
    const vacationAdmin = await roleSession(
      browser,
      world.actors.vacationAdmin,
      info,
    );
    sessions.push(vacationAdmin);
    const reporter = await roleSession(browser, world.actors.reporter, info);
    sessions.push(reporter);
    const operations = await roleSession(
      browser,
      world.actors.operations,
      info,
    );
    sessions.push(operations);
    const b = await roleSession(
      browser,
      world.actors.fsrB,
      info,
      19.4326,
      -99.1332,
    );
    sessions.push(b);
    const c = await roleSession(
      browser,
      world.actors.fsrC,
      info,
      19.0414,
      -98.2063,
    );
    sessions.push(c);
    const absenceReason = `Private candidate absence ${world.namespace}`;
    await createVacationUi(
      candidate.page,
      world,
      world.actors.candidateA,
      world.range(0, 1),
      absenceReason,
    );
    await decideVacationUi(vacationAdmin.page, absenceReason, true);
    await handoff(
      vacationAdmin.page,
      info,
      "incident-candidate-absence-approved-through-ui",
    );
    const incident = await reportIncidentUi(
      reporter.page,
      world,
      `Workflow incident ${world.namespace}`,
    );
    await handoff(
      reporter.page,
      info,
      "incident-reporter-center-and-decoded-report-photo",
    );
    await programReportedIncident(operations.page, world, incident, info);
    const first = await createAssignmentUi(
      operations.page,
      world,
      incident,
      world.actors.fsrB,
      `B assignment ${world.namespace}`,
      world.actors.candidateA,
    );
    const second = await createAssignmentUi(
      operations.page,
      world,
      incident,
      world.actors.fsrC,
      `C assignment ${world.namespace}`,
      world.actors.candidateA,
    );
    expect(first.id).not.toBe(second.id);
    expect(first.scheduledDate).not.toBeNull();
    expect(second.scheduledDate).toEqual(first.scheduledDate);
    await expect(
      operations.page.getByText(absenceReason, { exact: true }),
    ).toHaveCount(0);
    await handoff(
      operations.page,
      info,
      "incident-two-distinct-dated-sibling-assignments",
    );

    for (const [session, assignment, sibling] of [
      [b, first, second],
      [c, second, first],
    ] as const) {
      await gotoReady(session.page, `/fsr/assignments/${assignment.id}`);
      await expect(
        session.page
          .getByText(`AS-${assignment.folio}`, { exact: true })
          .first(),
      ).toBeVisible();
      const siblingBefore = await expectAssignmentStatus(
        sibling.id,
        session === b ? "ASIGNADO" : "VISTO",
      );
      await session.page
        .getByRole("button", { name: "Marcar como visto", exact: true })
        .click();
      const seen = await expectAssignmentStatus(assignment.id, "VISTO");
      expect(seen.seenById).toBe(
        session === b ? world.actors.fsrB.id : world.actors.fsrC.id,
      );
      expect(
        await expectAssignmentStatus(
          sibling.id,
          siblingBefore.status?.name as string,
        ),
      ).toEqual(siblingBefore);
      await handoff(
        session.page,
        info,
        `incident-${assignment.folio}-acknowledged-independently`,
      );
    }
    for (const [session, assignment, sibling] of [
      [b, first, second],
      [c, second, first],
    ] as const) {
      const siblingBefore = await db().assignment.findUniqueOrThrow({
        where: { id: sibling.id },
      });
      await session.page
        .getByRole("button", { name: "Iniciar trabajo", exact: true })
        .click();
      const started = await expectAssignmentStatus(assignment.id, "INICIADO");
      expect(started.startLatitude).toBe(session === b ? 19.4326 : 19.0414);
      await session.page.getByRole("button", { name: /Pausar/ }).click();
      await expectAssignmentStatus(assignment.id, "EN_PROGRESO");
      await handoff(
        session.page,
        info,
        `incident-${assignment.folio}-paused-en-progreso`,
      );
      await session.page.getByRole("button", { name: /Retomar/ }).click();
      await expectAssignmentStatus(assignment.id, "INICIADO");
      expect(
        await db().assignment.findUniqueOrThrow({ where: { id: sibling.id } }),
      ).toEqual(siblingBefore);
      await handoff(
        session.page,
        info,
        `incident-${assignment.folio}-resumed-with-sibling-unchanged`,
      );
    }

    const tripB = await startTripUi(
      b.page,
      world,
      0,
      first,
      incident.title,
      info,
    );
    const tripC = await startTripUi(
      c.page,
      world,
      1,
      second,
      incident.title,
      info,
    );
    expect(
      await db().vehicleTrip.count({
        where: {
          id: { in: [tripB.id, tripC.id] },
          status: { code: "EN_CURSO" },
        },
      }),
    ).toBe(2);
    expect(
      await db().vehicle.count({
        where: {
          id: { in: world.vehicles.map((vehicle) => vehicle.id) },
          status: { code: "IN_USE" },
        },
      }),
    ).toBe(2);

    for (const [index, session, assignment] of [
      [0, b, first],
      [1, c, second],
    ] as const) {
      await gotoReady(session.page, `/fsr/assignments/${assignment.id}`);
      const close = session.page.getByRole("button", {
        name: "Cerrar trabajo",
        exact: true,
      });
      await expect(close).toBeDisabled();
      await expect(close).toHaveAttribute(
        "title",
        "Captura el folio ODT y sube al menos una evidencia antes de cerrar",
      );
      await handoff(
        session.page,
        info,
        `incident-${assignment.folio}-closure-missing-odt-and-evidence`,
      );
      await session.page
        .getByRole("button", { name: "Capturar", exact: true })
        .click();
      await fillStable(
        session.page.getByLabel("Folio ODT del sistema externo"),
        `ODT-${index}-${world.namespace}`,
      );
      await session.page
        .getByRole("button", { name: "Guardar folio ODT", exact: true })
        .click();
      await expect(
        session.page.getByText(`ODT-${index}-${world.namespace}`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(close).toBeDisabled();
      await expect(close).toHaveAttribute(
        "title",
        "Sube al menos una evidencia antes de cerrar",
      );
      await session.page
        .getByRole("button", { name: "Agregar Actividad", exact: true })
        .click();
      const description = `Synthetic field repair ${index} ${world.namespace}`;
      await fillStable(session.page.getByLabel(/^Descripción/), description);
      const image = workflowImage(
        `activity-${index}-${world.namespace}.png`,
        100 + index * 30,
      );
      await session.page
        .locator('input[type="file"]')
        .first()
        .setInputFiles(image);
      await session.page
        .getByRole("button", { name: "Guardar Actividad", exact: true })
        .click();
      await expect(session.page.getByLabel(/^Descripción/)).toBeHidden();
      await expect(
        session.page.getByText(description, { exact: true }),
      ).toBeVisible();
      await decodedImage(
        session.page.getByRole("img", { name: image.name, exact: true }),
      );
      await expect(close).toBeEnabled();
      expect(
        await db().assignmentActivity.count({
          where: { assignmentId: assignment.id, description, active: true },
        }),
      ).toBe(1);
      await handoff(
        session.page,
        info,
        `incident-${assignment.folio}-odt-activity-and-decoded-evidence`,
      );
    }

    await b.context.setGeolocation({ latitude: 19.435, longitude: -99.135 });
    await c.context.setGeolocation({ latitude: 19.044, longitude: -98.209 });
    await finishTripUi(b.page, world, tripB.id, 0, info);
    expect(
      (
        await db().vehicleTrip.findUniqueOrThrow({
          where: { id: tripC.id },
          include: { status: true },
        })
      ).status.code,
    ).toBe("EN_CURSO");
    expect(
      (
        await db().vehicle.findUniqueOrThrow({
          where: { id: world.vehicles[1].id },
          include: { status: true },
        })
      ).status.code,
    ).toBe("IN_USE");
    await gotoReady(b.page, `/fsr/assignments/${first.id}`);
    await b.page
      .getByRole("button", { name: "Cerrar trabajo", exact: true })
      .click();
    const firstClosed = await expectAssignmentStatus(first.id, "CERRADO");
    expect(firstClosed.endLatitude).toBe(19.435);
    await expectAssignmentStatus(second.id, "INICIADO");
    const parentAfterFirst = await db().incident.findUniqueOrThrow({
      where: { id: incident.id },
      include: { status: true },
    });
    expect(parentAfterFirst.status?.code).not.toBe("CERRADO");
    expect(parentAfterFirst.resolvedAt).toBeNull();
    await handoff(
      b.page,
      info,
      "incident-first-sibling-closed-parent-still-open",
    );
    await finishTripUi(c.page, world, tripC.id, 1, info);
    await gotoReady(c.page, `/fsr/assignments/${second.id}`);
    await c.page
      .getByRole("button", { name: "Cerrar trabajo", exact: true })
      .click();
    const secondClosed = await expectAssignmentStatus(second.id, "CERRADO");
    expect(secondClosed.endLatitude).toBe(19.044);
    const parentClosed = await expectIncidentStatus(incident.id, "CERRADO");
    expect(parentClosed.resolvedAt).not.toBeNull();
    await handoff(
      c.page,
      info,
      "incident-last-sibling-auto-closes-parent-before-review",
    );

    for (const [index, assignment, closed] of [
      [0, first, firstClosed],
      [1, second, secondClosed],
    ] as const) {
      await gotoReady(operations.page, `/admin/assignments/${assignment.id}`);
      await expect(
        operations.page.getByText(`ODT-${index}-${world.namespace}`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        operations.page.getByText(
          `${closed.startLatitude}, ${closed.startLongitude}`,
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        operations.page.getByText(
          `${closed.endLatitude}, ${closed.endLongitude}`,
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        operations.page
          .getByText(formatMX(closed.startedAt as Date), { exact: true })
          .first(),
      ).toBeVisible();
      await expect(
        operations.page
          .getByText(formatMX(closed.finishedAt as Date), { exact: true })
          .first(),
      ).toBeVisible();
      await expect(
        operations.page.getByText(
          `Synthetic field repair ${index} ${world.namespace}`,
          { exact: true },
        ),
      ).toBeVisible();
      await decodedImage(
        operations.page.getByRole("img", {
          name: `activity-${index}-${world.namespace}.png`,
          exact: true,
        }),
      );
      await handoff(
        operations.page,
        info,
        `incident-operations-review-${assignment.folio}-odt-gps-activity-image`,
      );
    }
    await gotoReady(operations.page, "/admin/reports/vehicle-trips");
    for (const actor of [world.actors.fsrB, world.actors.fsrC]) {
      const row = operations.page
        .getByRole("row")
        .filter({ hasText: actor.name });
      await expect(row).toContainText("25");
    }
    await handoff(
      operations.page,
      info,
      "incident-operations-completed-trip-report",
    );
    await gotoReady(reporter.page, `/reporter/incidents/${incident.id}`);
    await expect(
      reporter.page.getByText(/CERRADO|Cerrado|Resuelto/).first(),
    ).toBeVisible();
    await decodedImage(
      reporter.page.getByRole("img", {
        name: incident.photo.name,
        exact: true,
      }),
    );
    await handoff(
      reporter.page,
      info,
      "incident-reporter-sees-same-closed-report",
    );
    await expectIncidentStatus(incident.id, "CERRADO");
  } finally {
    await closeSessions(sessions, info);
  }
});

for (const surface of ["full-edit", "tracking"] as const) {
  test(`incident ${surface} removes an already-selected FSR after UI vacation approval`, async ({
    browser,
    world,
  }, info) => {
    const sessions = [];
    try {
      const reporter = await roleSession(browser, world.actors.reporter, info);
      sessions.push(reporter);
      const operations = await roleSession(
        browser,
        world.actors.operations,
        info,
      );
      sessions.push(operations);
      const candidate = await roleSession(
        browser,
        world.actors.candidateA,
        info,
      );
      sessions.push(candidate);
      const vacationAdmin = await roleSession(
        browser,
        world.actors.vacationAdmin,
        info,
      );
      sessions.push(vacationAdmin);
      const incident = await reportIncidentUi(
        reporter.page,
        world,
        `Replacement ${surface} ${world.namespace}`,
        false,
      );
      const assignment = await createAssignmentUi(
        operations.page,
        world,
        incident,
        world.actors.candidateA,
        `Replacement assignment ${world.namespace}`,
      );
      const before = await db().assignment.findUniqueOrThrow({
        where: { id: assignment.id },
        include: { assignees: { where: { active: true } } },
      });
      const reason = `Private late approval ${world.namespace}`;
      await createVacationUi(
        candidate.page,
        world,
        world.actors.candidateA,
        world.range(0, 1),
        reason,
      );
      await decideVacationUi(vacationAdmin.page, reason, true);
      expect(
        await db().assignment.findUniqueOrThrow({
          where: { id: assignment.id },
          include: { assignees: { where: { active: true } } },
        }),
      ).toEqual(before);
      let trigger: Locator;
      let save: Locator;
      if (surface === "full-edit") {
        await gotoReady(
          operations.page,
          `/admin/assignments/${assignment.id}/edit`,
        );
        await operations.page
          .getByRole("button", { name: "Editar", exact: true })
          .click();
        trigger = operations.page.locator("#assignment-edit-fsrs");
        save = operations.page.getByRole("button", {
          name: "Guardar Cambios",
          exact: true,
        });
        await expect(
          operations.page.getByLabel(/Fecha programada/),
        ).toHaveValue(world.today);
      } else {
        await gotoReady(operations.page, "/admin/tracking");
        await fillStable(
          operations.page.locator("#folio"),
          `AS-${assignment.folio}`,
        );
        await operations.page
          .getByRole("button", { name: "Buscar", exact: true })
          .click();
        const row = operations.page
          .getByRole("row")
          .filter({ hasText: `INC-${incident.id}` })
          .first();
        await row.getByRole("button").first().click();
        const details = operations.page
          .getByRole("row")
          .filter({ hasText: "Detalles del Incidente" });
        await details
          .getByRole("button", { name: "Edición Rápida", exact: true })
          .nth(1)
          .click();
        trigger = operations.page.locator(`#wo-fsr-${assignment.id}`);
        save = details.getByRole("button", { name: "Guardar", exact: true });
        await expect(
          operations.page.locator(`#wo-date-${assignment.id}`),
        ).toHaveValue(world.today);
      }
      await trigger.click();
      await operations.page
        .getByPlaceholder("Buscar FSR...")
        .fill(world.actors.candidateA.name);
      const selected = operations.page
        .getByRole("option")
        .filter({ hasText: world.actors.candidateA.name });
      await expect(selected).toContainText("Ausencia aprobada");
      await expect(selected).toHaveAttribute("aria-label", /seleccionado/);
      await expect(
        operations.page.getByText(reason, { exact: true }),
      ).toHaveCount(0);
      await handoff(
        operations.page,
        info,
        `incident-${surface}-unavailable-selected-remains-visible`,
      );
      await selected.click();
      // Now unselected: no further addition of the unavailable candidate is allowed.
      await expect(selected).toHaveAttribute("aria-disabled", "true");
      await operations.page
        .getByPlaceholder("Buscar FSR...")
        .fill(world.actors.fsrB.name);
      await operations.page
        .getByRole("option")
        .filter({ hasText: world.actors.fsrB.name })
        .click();
      await operations.page
        .getByPlaceholder("Buscar FSR...")
        .fill(world.actors.fsrC.name);
      await operations.page
        .getByRole("option")
        .filter({ hasText: world.actors.fsrC.name })
        .click();
      await operations.page.keyboard.press("Escape");
      await save.click();
      await expect
        .poll(async () =>
          (
            await db().assignmentAssignee.findMany({
              where: { assignmentId: assignment.id, active: true },
            })
          )
            .map((row) => row.userId)
            .sort(),
        )
        .toEqual([world.actors.fsrB.id, world.actors.fsrC.id].sort());
      const after = await db().assignment.findUniqueOrThrow({
        where: { id: assignment.id },
      });
      expect(after.scheduledDate).toEqual(before.scheduledDate);
      expect(after.statusId).toBe(before.statusId);
      await handoff(
        operations.page,
        info,
        `incident-${surface}-valid-replacement-preserves-date-and-status`,
      );
    } finally {
      await closeSessions(sessions, info);
    }
  });
}
