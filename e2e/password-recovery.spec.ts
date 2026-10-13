import { createHash } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { hashPassword } from "../src/lib/security/hash";
import { db, uniqueSuffix } from "./fixtures/db";
import { waitForMessage } from "./fixtures/mail";

// Bearer links must not be retained in screenshots, videos or traces.
test.use({ trace: "off", screenshot: "off", video: "off" });

test("email recovery resets credentials once and revokes existing sessions", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const email = `recovery-${uniqueSuffix()}@test.local`;
  const originalPassword = "Original-password-42";
  const newPassword = "Recovery-password-42";
  const [role, status] = await Promise.all([
    db().role.findUniqueOrThrow({ where: { name: "GUEST" } }),
    db().userStatus.findFirstOrThrow({ where: { code: "ACTIVO" } }),
  ]);
  await db().user.create({
    data: {
      email,
      name: "Recovery E2E",
      password: await hashPassword(originalPassword),
      userStatusId: status.id,
      userRoles: { create: { roleId: role.id } },
    },
  });
  const oldSession = await browser.newContext();
  const oldPage = await oldSession.newPage();
  async function login(target: Page, password: string) {
    await target.goto("/login");
    await target.getByLabel("Correo electrónico", { exact: true }).fill(email);
    await target.getByLabel("Contraseña", { exact: true }).fill(password);
    await target
      .getByRole("button", { name: "Iniciar Sesión", exact: true })
      .click();
  }
  async function reset(password: string, confirmation: string) {
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(password);
    await page
      .getByLabel("Confirmar contraseña", { exact: true })
      .fill(confirmation);
    await page
      .getByRole("button", { name: "Restablecer contraseña", exact: true })
      .click();
  }
  async function snapshot() {
    const account = await db().user.findUniqueOrThrow({
      where: { email },
      select: {
        password: true,
        sessionVersion: true,
        active: true,
        passwordResetToken: true,
      },
    });
    return createHash("sha256").update(JSON.stringify(account)).digest("hex");
  }
  try {
    await login(oldPage, originalPassword);
    await expect(oldPage).toHaveURL(/\/inicio$/);
    await page.goto("/login");
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Si tu cuenta está habilitada",
    );
    const message = await waitForMessage({
      to: email,
      subject: /Restablece tu contraseña/,
    });
    const response = await fetch(
      `${process.env.E2E_MAILPIT_URL}/api/v1/message/${message.ID}`,
    );
    expect(response.ok).toBe(true);
    const body = await response.json();
    const link = body.Text.match(/https?:\/\/\S+/)[0];
    const url = new URL(link);
    const token = url.hash.slice(1);
    expect(url.pathname).toBe("/reset-password");
    expect(url.search).toBe("");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const stored = await db().passwordResetToken.findUniqueOrThrow({
      where: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
      },
    });
    expect(stored.expiresAt.getTime() - stored.requestedAt.getTime()).toBe(
      1_800_000,
    );
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(
      await db().emailOutbox.count({ where: { text: { contains: token } } }),
    ).toBe(0);
    await page.goto(link);
    await expect(
      page.getByLabel("Nueva contraseña", { exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
    const before = await snapshot();
    await reset(newPassword, "different-password");
    await expect(page.locator("p[role=alert]")).toHaveText(
      "Las contraseñas no coinciden.",
    );
    expect(await snapshot()).toBe(before);
    await reset(newPassword, newPassword);
    await expect(page.getByRole("status")).toHaveText(
      "Contraseña restablecida. Inicia sesión con tu nueva contraseña.",
    );
    await oldPage.goto("/profile");
    await expect(oldPage).toHaveURL(/\/login(?:\?|$)/);
    const after = await snapshot();
    // The same document must capture the newly opened fragment, even after success.
    await page.goto(link);
    await expect(
      page.getByLabel("Nueva contraseña", { exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
    await reset(newPassword, newPassword);
    await expect(page.locator("p[role=alert]")).toHaveText(
      "El enlace no es válido o ha expirado. Solicita uno nuevo.",
    );
    expect(await snapshot()).toBe(after);
    await login(page, originalPassword);
    await expect(
      page.getByText(
        "Credenciales inválidas. Por favor, verifica tu correo y contraseña.",
      ),
    ).toBeVisible();
    await login(page, newPassword);
    await expect(page).toHaveURL(/\/inicio$/);
  } finally {
    await oldSession.close();
  }
});
