import fs from "node:fs";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";

/**
 * Screenshots of what a passing test actually saw.
 *
 * Playwright's built-in `screenshot: "only-on-failure"` captures nothing when a
 * test succeeds, which is exactly backwards for handing operational evidence to
 * someone: "the incident flow works" is a claim, and a reader has no way to
 * check it without re-running the suite.
 *
 * Each shot goes to two places on purpose:
 *   - attached to the HTML report, where it sits next to the step that took it;
 *   - written to `evidencias/<spec>/NN-<nombre>.png`, so the folder can be
 *     zipped and sent to someone who is never going to open a Playwright report.
 */

const ROOT = path.join(process.cwd(), "evidencias");

/** Ordinal per test, so the files sort in the order the steps happened. */
const counters = new Map<string, number>();

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * Capture the current page as evidence of a step.
 *
 * @param label What the reader should understand the picture proves, in the
 *              same words the report will show — "incidente creado y ABIERTO",
 *              not "step 3".
 */
export async function evidence(
  page: Page,
  testInfo: TestInfo,
  label: string,
  /**
   * What the picture is supposed to prove, scrolled into frame first.
   *
   * `fullPage` does not help in this app: the layout gives `<main>` its own
   * `overflow-auto` inside a `h-screen` shell, so the document never scrolls
   * and a full-page shot is just the viewport. Without this, a caption like
   * "actividad registrada en el historial" sat above a screenshot of the page
   * header.
   */
  focus?: Locator,
): Promise<void> {
  const key = testInfo.titlePath.join(" › ");
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);

  // Let animations and any pending navigation settle: a screenshot taken
  // mid-transition documents a state the user never sees. Bounded explicitly —
  // the default is 30s, and a page that polls never goes idle, so N shots could
  // silently add half a minute each to the run.
  await page
    .waitForLoadState("networkidle", { timeout: 3_000 })
    .catch(() => {});

  if (focus) {
    await focus.scrollIntoViewIfNeeded().catch(() => {});
  }

  const body = await page.screenshot({ fullPage: true });

  await testInfo.attach(`${String(next).padStart(2, "0")} · ${label}`, {
    body,
    contentType: "image/png",
  });

  // Project first, then one folder per test.
  //
  // Per project because a spec outside the `flows` project runs once per
  // browser, and all five would otherwise race to write the same file. Per test
  // because the ordinal restarts with each one — sharing a folder made three
  // different steps all land on "01-" and lost the order the run happened in.
  const dir = path.join(
    ROOT,
    slug(testInfo.project.name),
    slug(testInfo.titlePath.slice(0, -1).join("-")),
    slug(testInfo.title),
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${String(next).padStart(2, "0")}-${slug(label)}.png`),
    body,
  );
}

/** Empty the evidence folder so a run never mixes with the previous one. */
export function resetEvidence(): void {
  fs.rmSync(ROOT, { recursive: true, force: true });
}
