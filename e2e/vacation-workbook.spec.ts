import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { authFile } from "./fixtures/auth";
import { db, uniqueSuffix } from "./fixtures/db";
import { gotoReady } from "./fixtures/navigation";

test.use({ storageState: authFile("admin-vacaciones") });

test("admin reads pending source evidence and configures grace; FSR cannot download it", async ({
  page,
  browser,
}) => {
  const suffix = uniqueSuffix();
  const digest = createHash("sha256").update(suffix).digest("hex");
  const sourceName = `Synthetic Workbook ${suffix}`;
  const setting = await db().vacationSetting.findUniqueOrThrow({
    where: { id: 1 },
  });
  await db().vacationWorkbook.create({
    data: {
      digest,
      filename: "synthetic.xlsm",
      source: { rule: "Synthetic original rule" },
      rows: {
        create: {
          sourceSheet: "Vacaciones 2026-2027",
          sourceRow: 3,
          cycleYear: 2026,
          sourceName,
          yearsOfService: 3,
          entitledDays: 16,
          takenDays: 0,
          remainingDays: 16,
          issues: ["UNMATCHED_IDENTITY"],
          sourceValues: [
            null,
            sourceName,
            null,
            3,
            "Synthetic original days",
            16,
            0,
            16,
            "Synthetic original note",
          ],
        },
      },
    },
  });
  try {
    await gotoReady(page, "/admin/vacations");
    await expect(
      page.getByRole("heading", { name: "Historial del Excel de vacaciones" }),
    ).toBeVisible();
    await page.getByText("Vacaciones 2026-2027", { exact: true }).click();
    await expect(
      page.getByRole("cell", { name: sourceName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Sin cuenta coincidente", { exact: true }),
    ).toBeVisible();
    const response = await page.request.get(
      `/api/vacations/workbooks/${digest}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.json()).source.rule).toBe("Synthetic original rule");
    const fsr = await browser.newContext({ storageState: authFile("fsr") });
    try {
      expect(
        (await fsr.request.get(`/api/vacations/workbooks/${digest}`)).status(),
      ).toBe(403);
    } finally {
      await fsr.close();
    }
    await gotoReady(page, "/admin/settings/vacation-accrual");
    await page.getByLabel("Meses de vigencia").fill("3");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await db().vacationSetting.findUniqueOrThrow({ where: { id: 1 } }))
            .graceWindowMonths,
      )
      .toBe(3);
  } finally {
    await db().vacationSetting.update({
      where: { id: 1 },
      data: { graceWindowMonths: setting.graceWindowMonths },
    });
    await db().vacationWorkbookRow.deleteMany({
      where: { workbookDigest: digest },
    });
    await db().vacationWorkbook.delete({ where: { digest } });
  }
});
