import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

it("preserves globe geometry when adding its accessibility title", () => {
  const svg = read("public/globe.svg")
    .replace(/<title>.*?<\/title>/, "")
    .trim();

  expect(createHash("sha256").update(svg).digest("hex")).toBe(
    "b614b9bf183925957661ac851498fe1d8029fd43a62fbfed86f9e2624a57e7cf",
  );
});

it("aligns the manifest, lockfile and paired dependencies", () => {
  const manifest = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));

  expect(lock.packages[""].engines.node).toBe("24.x");
  for (const section of ["dependencies", "devDependencies"]) {
    expect(lock.packages[""][section]).toEqual(manifest[section]);
  }

  for (const [left, right] of [
    ["prisma", "@prisma/client"],
    ["react", "react-dom"],
    ["vitest", "@vitest/ui"],
    ["vitest", "@vitest/coverage-v8"],
    ["tailwindcss", "@tailwindcss/postcss"],
  ]) {
    expect(lock.packages[`node_modules/${left}`].version).toBe(
      lock.packages[`node_modules/${right}`].version,
    );
  }
});

it("native bcrypt preserves empty and Unicode password behavior", async () => {
  for (const password of ["", "Contraseña24!"]) {
    const hash = await bcrypt.hash(password, 4);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare(`${password}x`, hash)).toBe(false);
  }
});

it("buffered mail preserves recipients and attachments without file writes", async () => {
  const digest = () =>
    createHash("sha256").update(read("package-lock.json")).digest("hex");
  const before = digest();
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });

  const result = await transport.sendMail({
    from: "sender@example.com",
    to: "recipient@example.com",
    bcc: "hidden@example.com",
    subject: "Vacation request — México",
    text: "Line 24",
    attachments: [
      { filename: "evidence.txt", content: Buffer.from("scratch evidence 24") },
    ],
  });

  const mime = result.message.toString();
  expect(result.envelope.to).toEqual([
    "recipient@example.com",
    "hidden@example.com",
  ]);
  // Stream transport retains BCC headers; SMTP transport handles their removal.
  expect(mime).toContain("Bcc: hidden@example.com");
  expect(mime).toContain("Subject: =?UTF-8?");
  expect(mime).toContain("filename=evidence.txt");
  expect(mime).toContain(Buffer.from("scratch evidence 24").toString("base64"));
  expect(digest()).toBe(before);
});
