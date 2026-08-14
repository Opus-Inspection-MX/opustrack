import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTransport, sendMailSpy } = vi.hoisted(() => {
  const sendMailSpy = vi.fn();
  return {
    sendMailSpy,
    createTransport: vi.fn(() => ({ sendMail: sendMailSpy })),
  };
});

vi.mock("nodemailer", () => ({ default: { createTransport } }));

import { getMailTransport, resetMailTransport, sendMail } from "./index";

/**
 * The switch between "there is a mail server" and "there is not".
 *
 * The no-op path is what lets a developer machine and the unit suite run with
 * zero configuration; without it, creating an incident would fail on a laptop.
 */

const ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  // `clearAllMocks` wipes the recorded calls but keeps implementations, so a
  // `mockRejectedValue` from one test would leak into the next and make it
  // pass for the wrong reason.
  sendMailSpy.mockReset();
  sendMailSpy.mockResolvedValue({ messageId: "test" });
  resetMailTransport();
});

afterEach(() => {
  process.env = { ...ENV };
  resetMailTransport();
});

describe("elección de transporte", () => {
  it("sin SMTP_HOST no envía nada y no falla", async () => {
    process.env.SMTP_HOST = undefined;
    delete process.env.SMTP_HOST;

    expect(getMailTransport().name).toBe("noop");
    await expect(
      sendMail({ to: ["a@b.com"], subject: "Hola", text: "cuerpo" }),
    ).resolves.toBeUndefined();
    expect(sendMailSpy).not.toHaveBeenCalled();
  });

  it("con SMTP_HOST usa SMTP", () => {
    process.env.SMTP_HOST = "localhost";
    process.env.SMTP_PORT = "1025";

    expect(getMailTransport().name).toContain("smtp");
  });

  it("memoiza el transporte", () => {
    process.env.SMTP_HOST = "localhost";

    getMailTransport();
    getMailTransport();

    // One connection pool, not one per notification.
    expect(createTransport).toHaveBeenCalledTimes(1);
  });
});

describe("envío", () => {
  beforeEach(() => {
    process.env.SMTP_HOST = "localhost";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_FROM = "OpusTrack <no-reply@opusinspection.com>";
  });

  it("manda un solo mensaje con los destinatarios en BCC", async () => {
    await sendMail({
      to: ["a@b.com", "c@d.com"],
      subject: "Nuevo incidente",
      text: "cuerpo",
    });

    // One message, and nobody learns who else was notified.
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    expect(sendMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bcc: ["a@b.com", "c@d.com"],
        subject: "Nuevo incidente",
      }),
    );
  });

  it("no llama al servidor cuando no hay destinatarios", async () => {
    await sendMail({ to: [], subject: "Nadie", text: "cuerpo" });
    expect(sendMailSpy).not.toHaveBeenCalled();
  });

  it("un fallo del servidor no propaga", async () => {
    sendMailSpy.mockRejectedValue(new Error("conexión rechazada"));

    // An incident must not fail to be created because the mail server is down.
    await expect(
      sendMail({ to: ["a@b.com"], subject: "X", text: "y" }),
    ).resolves.toBeUndefined();
  });

  it("escapa el HTML del cuerpo", async () => {
    await sendMail({
      to: ["a@b.com"],
      subject: "X",
      text: "<script>alert(1)</script>",
    });

    const arg = sendMailSpy.mock.calls[0][0];
    expect(arg.html).toContain("&lt;script&gt;");
    expect(arg.html).not.toContain("<script>");
  });
});
