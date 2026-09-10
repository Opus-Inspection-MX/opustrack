/**
 * The one email layout.
 *
 * Short operational alerts whose job is to get someone into the app, so the
 * link matters and the layout does not: an OpusTrack header, one paragraph,
 * one button, plain-text twin. Every event reuses it through its catalog
 * `render` — three bespoke templates used to drift apart for no reason.
 */

/** Absolute URL for a path, so the link works from a mail client. */
export function appUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

/** Escape text for HTML, with line breaks preserved. */
export function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br>");
}

export interface RenderEmailInput {
  subject: string;
  /** One or two sentences: what happened and why it matters. */
  intro: string;
  /** App path (or absolute URL) behind the button. Omit for no button. */
  link?: string | null;
  /** Button label. Defaults to "Abrir en OpusTrack". */
  cta?: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** One layout for every event: header, paragraph, button, text twin. */
export function renderEmail(input: RenderEmailInput): RenderedEmail {
  const { subject, intro } = input;
  const cta = input.cta ?? "Abrir en OpusTrack";
  const url = input.link ? appUrl(input.link) : null;

  const text = url
    ? [`${intro}`, "", `${cta}: ${url}`, "", "— OpusTrack"].join("\n")
    : [`${intro}`, "", "— OpusTrack"].join("\n");

  const button = url
    ? `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;padding:12px 24px;background-color:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">${cta}</a></p>`
    : "";

  const html = [
    `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111827;max-width:560px">`,
    `<p style="font-size:18px;font-weight:700;margin:0 0 4px">OpusTrack</p>`,
    `<p style="color:#6b7280;margin:0 0 16px">${subject}</p>`,
    `<p style="margin:0 0 8px">${toHtml(intro)}</p>`,
    button,
    `<p style="color:#9ca3af;font-size:12px;margin:16px 0 0">— OpusTrack</p>`,
    `</div>`,
  ].join("");

  return { subject, text, html };
}
