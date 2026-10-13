import { deflateSync } from "node:zlib";
import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { db } from "./db";
import {
  comboboxByLabel,
  fillStable,
  fillStableAll,
  pickFromCombobox,
} from "./forms";
import { submitLogin } from "./login";
import { gotoReady } from "./navigation";
import type { WorkflowActor, WorkflowWorld } from "./workflows";

/** Minimal genuine RGB PNG, with CRCs and compressed scanlines, not disguised text. */
export function workflowImage(name: string, color = 90) {
  function chunk(type: string, data: Buffer) {
    const tag = Buffer.from(type);
    const bytes = Buffer.concat([tag, data]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, bytes, checksum]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16, 0);
  header.writeUInt32BE(16, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.concat(
    Array.from({ length: 16 }, () =>
      Buffer.concat([Buffer.from([0]), Buffer.alloc(48, color)]),
    ),
  );
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(pixels)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  };
}

export async function decodedImage(image: Locator) {
  await expect(image).toBeVisible();
  // Playwright visibility ignores the fold, but lazy images below it never
  // load: scroll first so the browser picks a srcSet candidate. Real operators
  // scroll; the served bytes stay proven by the decode itself.
  await image.scrollIntoViewIfNeeded();
  // Never await img.decode() directly: when the load stalls mid-flight it
  // never settles and the whole test hangs past every assertion timeout.
  // `complete` flips on load AND on error, so poll it bounded and then read
  // the decoded dimensions: nonzero proves a real decode (WF-03), zero with
  // complete proves a broken source instead of hanging forever.
  await expect
    .poll(
      async () =>
        image.evaluate((element) => {
          const img = element as HTMLImageElement;
          return img.complete ? [img.naturalWidth, img.naturalHeight] : null;
        }),
      { timeout: 30_000 },
    )
    .not.toBeNull();
  const dimensions = await image.evaluate((element) => {
    const img = element as HTMLImageElement;
    return [img.naturalWidth, img.naturalHeight, img.currentSrc] as const;
  });
  expect(
    dimensions[0],
    `image loaded but undecodable: ${dimensions[2].slice(-100)}`,
  ).toBeGreaterThan(0);
  expect(
    dimensions[1],
    `image loaded but undecodable: ${dimensions[2].slice(-100)}`,
  ).toBeGreaterThan(0);
}

export async function handoff(page: Page, info: TestInfo, label: string) {
  await info.attach(label, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

/** Independent synthetic sessions. No ROOT storage-state or shared auth setup. */
export async function roleSession(
  browser: Browser,
  actor: WorkflowActor,
  info: TestInfo,
  latitude = 19.4326,
  longitude = -99.1332,
) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    baseURL: String(info.project.use.baseURL),
    geolocation: { latitude, longitude },
    permissions: ["geolocation"],
    timezoneId: "America/Mexico_City",
  });
  try {
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.accept());
    await gotoReady(page, "/login");
    await Promise.all([
      page.waitForURL(/\/inicio\/?$/, { waitUntil: "domcontentloaded" }),
      submitLogin(page, actor.email, actor.password),
    ]);
    return { page, context };
  } catch (error) {
    try {
      const path = info.outputPath("synthetic-login-failure-trace.zip");
      await context.tracing.stop({ path });
      await info.attach("synthetic-login-failure-trace", {
        path,
        contentType: "application/zip",
      });
    } finally {
      await context.close();
    }
    throw error;
  }
}

export async function closeSessions(
  sessions: { context: BrowserContext }[],
  info: TestInfo,
) {
  const failures: unknown[] = [];
  for (const [index, { context }] of sessions.entries()) {
    try {
      const path = info.outputPath(`synthetic-role-${index}-trace.zip`);
      try {
        await context.tracing.stop({ path });
      } catch (error) {
        // A broken/timed-out context may have no active tracing; the trace
        // is best-effort evidence, closing the context is mandatory.
        failures.push(error);
      }
      try {
        await info.attach(`synthetic-role-${index}-trace`, {
          path,
          contentType: "application/zip",
        });
      } catch {
        // Attach requires the file written by a successful stop above.
      }
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        await context.close();
      } catch (error) {
        failures.push(error);
      }
    }
  }
  // On an already-failed/timed-out test the traces are diagnostics, not the
  // verdict: report them without masking the original failure.
  if (failures.length > 0 && info.status === "passed")
    throw new AggregateError(
      failures,
      "Failed to finish synthetic workflow evidence cleanup.",
    );
  if (failures.length > 0)
    process.stderr.write(
      `WF cleanup warnings (test ${info.status}): ${failures.length} session(s) skipped trace capture.\n`,
    );
}

export function vacationRow(page: Page, reason: string) {
  return page.getByRole("row").filter({ hasText: reason });
}

export async function createVacationUi(
  page: Page,
  world: WorkflowWorld,
  holder: WorkflowActor,
  range: { start: string; end: string },
  reason: string,
  admin = false,
) {
  world.assertSameDay();
  await gotoReady(page, admin ? "/admin/vacations/new" : "/vacations/new");
  if (admin) await page.locator("#userId").selectOption(holder.id);
  else await expect(page.locator("#userId")).toHaveCount(0);
  await fillStableAll([
    [page.locator("#startDate"), range.start],
    [page.locator("#endDate"), range.end],
    [page.locator("#reason"), reason],
  ]);
  // Await the navigation together with the click: a click that never
  // navigates would otherwise leave waitForURL hanging (no default timeout).
  await Promise.all([
    page.waitForURL(admin ? /\/admin\/vacations$/ : /\/vacations$/, {
      waitUntil: "domcontentloaded",
    }),
    page.getByRole("button", { name: "Enviar Solicitud", exact: true }).click(),
  ]);
  await expect(vacationRow(page, reason)).toHaveCount(1);
  await expect(vacationRow(page, reason)).toContainText("Pendiente");
  // The unique visible request reason corroborates the immutable request ID.
  const row = await db().vacation.findFirstOrThrow({
    where: { userId: holder.id, reason, active: true },
    include: { status: true },
  });
  expect(row.status.code).toBe("PENDIENTE");
  return row;
}

export async function openVacationEdit(
  page: Page,
  reason: string,
  holder: WorkflowActor,
) {
  await vacationRow(page, reason)
    .getByRole("button", { name: "Editar solicitud", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Editar solicitud de vacaciones",
    exact: true,
  });
  await expect(dialog.getByLabel("Titular", { exact: true })).toHaveValue(
    holder.name,
  );
  await expect(dialog.getByLabel("Titular", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  return dialog;
}

export async function editVacationUi(
  page: Page,
  oldReason: string,
  holder: WorkflowActor,
  range: { start: string; end: string },
  reason: string,
) {
  const dialog = await openVacationEdit(page, oldReason, holder);
  await fillStableAll([
    [dialog.getByLabel("Fecha de inicio", { exact: true }), range.start],
    [dialog.getByLabel("Fecha de fin", { exact: true }), range.end],
    [dialog.getByLabel(/^Motivo/), reason],
  ]);
  await dialog
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(vacationRow(page, reason)).toHaveCount(1);
}

export async function decideVacationUi(
  page: Page,
  reason: string,
  approve: boolean,
) {
  await gotoReady(page, "/admin/vacations");
  await vacationRow(page, reason)
    .getByRole("button", {
      name: approve ? "Aprobar" : "Rechazar",
      exact: true,
    })
    .click();
  if (approve) {
    const warning = page.getByRole("dialog", {
      name: "Hay trabajo programado en esas fechas",
    });
    await expect(async () => {
      if (await warning.isVisible())
        await warning
          .getByRole("button", { name: "Aprobar de todos modos" })
          .click();
      await expect(vacationRow(page, reason)).toContainText("Aprobada", {
        timeout: 1000,
      });
    }).toPass({ timeout: 15_000 });
  } else await expect(vacationRow(page, reason)).toContainText("Rechazada");
}

export async function cancelVacationUi(page: Page, reason: string) {
  await vacationRow(page, reason)
    .getByRole("button", { name: "Cancelar solicitud", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Cancelar solicitud de vacaciones",
  });
  await dialog
    .getByRole("button", { name: "Confirmar cancelación", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(vacationRow(page, reason)).toHaveCount(0);
}

export async function reportIncidentUi(
  page: Page,
  world: WorkflowWorld,
  title: string,
  withImage = true,
) {
  await gotoReady(page, "/reporter/new");
  await expect(
    page.getByText(`${world.client.name} (${world.client.code})`, {
      exact: true,
    }),
  ).toBeVisible();
  await fillStableAll([
    [page.locator("#title"), title],
    [page.locator("#description"), `Synthetic incident ${world.namespace}`],
    [page.locator("#reporterName"), `Synthetic reporter ${world.namespace}`],
  ]);
  await comboboxByLabel(page, "Tipo de Incidente *").click();
  await page.getByRole("option").first().click();
  await comboboxByLabel(page, "Línea (Opcional)").click();
  await page
    .getByRole("option", { name: world.line.name, exact: true })
    .click();
  await comboboxByLabel(page, "Equipo (Opcional)").click();
  await page
    .getByRole("option", { name: world.equipment.name, exact: true })
    .click();
  const photo = workflowImage(`report-${world.namespace}.png`, 50);
  if (withImage)
    await page.locator('input[type="file"]').first().setInputFiles(photo);
  await Promise.all([
    page.waitForURL(/\/reporter$/, { waitUntil: "domcontentloaded" }),
    page.getByRole("button", { name: "Enviar Reporte", exact: true }).click(),
  ]);
  const card = page
    .getByRole("heading", { name: title, exact: true })
    .locator("../..");
  const link = card.getByRole("link", { name: "Ver Detalles", exact: true });
  // Reporter cards expose a navigable immutable incident ID.
  const href = await link.first().getAttribute("href");
  expect(href).toMatch(/\/reporter\/incidents\/\d+$/);
  const id = Number(href?.split("/").at(-1));
  await link.first().click();
  await expect(
    page.getByText(`INC-${id}`, { exact: false }).first(),
  ).toBeVisible();
  if (withImage)
    await decodedImage(
      page.getByRole("img", { name: photo.name, exact: true }),
    );
  const stored = await db().incident.findUniqueOrThrow({ where: { id } });
  expect(stored).toMatchObject({
    title,
    clientId: world.client.id,
    reportedById: world.actors.reporter.id,
    lineId: world.line.id,
    equipmentId: world.equipment.id,
  });
  return { id, title, photo };
}

export async function createAssignmentUi(
  page: Page,
  world: WorkflowWorld,
  incident: { id: number; title: string },
  fsr: WorkflowActor | WorkflowActor[],
  marker: string,
  unavailable?: WorkflowActor,
) {
  const assignees = Array.isArray(fsr) ? fsr : [fsr];
  await gotoReady(page, "/admin/assignments/new");
  await pickFromCombobox(page, {
    trigger: comboboxByLabel(page, "Incidente *"),
    searchPlaceholder: "Buscar incidente...",
    search: incident.title,
    option: incident.title,
  });
  await fillStable(page.locator("#scheduledDate"), world.today);
  const trigger = page.locator("#assignment-fsrs");
  await expect(trigger).toBeEnabled();
  await trigger.click();
  if (unavailable) {
    await page.getByPlaceholder("Buscar FSR...").fill(unavailable.name);
    const option = page
      .getByRole("option")
      .filter({ hasText: unavailable.name });
    await expect(option).toHaveAttribute("aria-disabled", "true");
    await expect(option).toContainText(/ausencia|vacaciones/i);
  }
  for (const actor of assignees) {
    await page.getByPlaceholder("Buscar FSR...").fill(actor.name);
    await page.getByRole("option").filter({ hasText: actor.name }).click();
  }
  await page.keyboard.press("Escape");
  await fillStable(page.locator("#notes"), marker);
  await Promise.all([
    page.waitForURL(/\/admin\/assignments$/, { waitUntil: "domcontentloaded" }),
    page.getByRole("button", { name: "Crear Asignación", exact: true }).click(),
  ]);
  const row = page.getByRole("row").filter({ hasText: marker });
  // The index may show notes only on detail; use the unique synthetic FSR/incident row.
  const target = (await row.count())
    ? row
    : page
        .getByRole("row")
        .filter({ hasText: incident.title })
        .filter({ hasText: assignees[0].name });
  await expect(target).toHaveCount(1);
  const href = await target
    .locator('a[href^="/admin/assignments/"]')
    .first()
    .getAttribute("href");
  expect(href).toMatch(/\/admin\/assignments\/[^/]+$/);
  const id = href?.split("/").at(-1) as string;
  const stored = await db().assignment.findUniqueOrThrow({
    where: { id },
    include: { assignees: { where: { active: true } }, status: true },
  });
  expect(stored.incidentId).toBe(incident.id);
  expect(stored.assignees.map((row) => row.userId).sort()).toEqual(
    assignees.map((actor) => actor.id).sort(),
  );
  expect(stored.notes).toBe(marker);
  return stored;
}
