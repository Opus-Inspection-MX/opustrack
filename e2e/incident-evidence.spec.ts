import { expect, test } from "@playwright/test";
import { authFile } from "./fixtures/auth";
import {
  db,
  disconnectDb,
  findIncidentByTitle,
  uniqueSuffix,
} from "./fixtures/db";
import { evidence } from "./fixtures/evidence";
import { fillFieldById } from "./fixtures/forms";
import { gotoReady } from "./fixtures/navigation";

/**
 * E2E coverage for RF-217 (incident evidence photos).
 *
 * The REPORTER stages a file on /reporter/new; after the incident is created the
 * page uploads it as an IncidentAttachment. The detail view lists it.
 *
 * The uploaded file is a minimal PDF on purpose: AttachmentPreview renders
 * images through next/image (which would try to optimise a fixture that is
 * not a real photo), while a PDF renders an icon — same trick as
 * prepareAssignmentForClose in fixtures/db.ts.
 *
 * Serial by nature: every step consumes what the previous one produced.
 */

const SUFFIX = uniqueSuffix();
const INCIDENT_TITLE = `E2E evidencia ${SUFFIX}`;

/** Minimal valid PDF: enough bytes for the MIME allowlist, no reader needed. */
const EVIDENCE_PDF = {
  name: "evidencia-e2e.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
  ),
};

/** Shared across steps. */
let incidentId: number;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await disconnectDb();
});

test.describe("REPORTER reporta con evidencia (RF-217)", () => {
  test.use({ storageState: authFile("reporter") });

  test("adjunta un archivo al reportar y queda como IncidentAttachment", async ({
    page,
  }, testInfo) => {
    await gotoReady(page, "/reporter/new");

    await fillFieldById(page, "title", INCIDENT_TITLE);
    await fillFieldById(
      page,
      "description",
      "Incidente con evidencia generado por la suite e2e.",
    );

    // Radix Select: trigger, then the listbox option.
    await page.getByText("Selecciona el tipo de incidente").click();
    await page.getByRole("option").first().click();

    // FileUpload keeps two hidden inputs (file picker first, camera second).
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(EVIDENCE_PDF);
    await expect(page.getByText("Archivos seleccionados (1)")).toBeVisible();

    await page.getByRole("button", { name: "Enviar Reporte" }).click();
    await page.waitForURL("**/reporter");

    const incident = await findIncidentByTitle(INCIDENT_TITLE);
    expect(incident, "el incidente debe existir").not.toBeNull();
    incidentId = (incident as NonNullable<typeof incident>).id;

    const attachments = await db().incidentAttachment.findMany({
      where: { incidentId, active: true },
    });
    expect(attachments, "la evidencia debe guardarse en BD").toHaveLength(1);
    expect(attachments[0].provider).toBe("filesystem");

    await evidence(page, testInfo, "incidente creado con evidencia adjunta");
  });

  test("la evidencia se ve en el detalle del incidente", async ({
    page,
  }, testInfo) => {
    await gotoReady(page, `/reporter/incidents/${incidentId}`);

    // getByRole ignora las copias de streaming en `div[hidden]` (patrón A1
    // de docs/plans/tema-opus.md): getByText resolvía a 2 <h2> y violaba el
    // modo estricto en Mobile. Sigue asertando visibilidad para el usuario.
    await expect(
      page.getByRole("heading", { name: "Evidencia fotográfica (1)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "evidencia-e2e.pdf" }),
    ).toBeVisible();

    await evidence(page, testInfo, "evidencia visible en el detalle");
  });
});
