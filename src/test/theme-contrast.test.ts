import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contraste WCAG 2.x sobre los tokens, sin navegador.
 *
 * axe no puede medir fondos en degradado (los marca `incomplete`), así que
 * los extremos del hero (`--hero-from`/`--hero-to`) se evalúan aquí contra
 * sus textos. Todo color de tema va en hex de 6 dígitos para que esta
 * prueba lo pueda leer: un valor nuevo en `oklch` la rompe a propósito.
 */

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function block(selector: ":root" | ".dark"): Map<string, string> {
  const match = CSS.match(new RegExp(`${escapeRegExp(selector)}\\s*{([^}]*)}`));
  if (!match) throw new Error(`bloque ${selector} no encontrado`);
  const vars = new Map<string, string>();
  for (const [, name, value] of match[1].matchAll(
    /--([\w-]+)\s*:\s*([^;]+);/g,
  )) {
    vars.set(name, value.trim());
  }
  return vars;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ROOT = block(":root");
const DARK = block(".dark");

/** Tema oscuro = `:root` más las redefiniciones de `.dark`. */
function resolve(theme: "light" | "dark", token: string): string {
  const found =
    theme === "dark" ? (DARK.get(token) ?? ROOT.get(token)) : ROOT.get(token);
  expect(found, `token --${token} existe en tema ${theme}`).toBeDefined();
  expect(found, `--${token} es hex de 6 dígitos`).toMatch(HEX6);
  return found as string;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = channel(Number.parseInt(hex.slice(1, 3), 16));
  const g = channel(Number.parseInt(hex.slice(3, 5), 16));
  const b = channel(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG 2.x entre dos hex. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [texto, fondo, mínimo] — se evalúa en ambos temas. */
const PAIRS: Array<[string, string, number]> = [
  ["foreground", "background", 4.5],
  ["card-foreground", "card", 4.5],
  ["popover-foreground", "popover", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "card", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["destructive-foreground", "destructive", 4.5],
  // Enlaces: el primario como texto sobre el fondo.
  ["primary", "background", 4.5],
  // Foco visible.
  ["ring", "background", 3],
  ["sidebar-foreground", "sidebar", 4.5],
  ["sidebar-muted-foreground", "sidebar", 4.5],
  ["sidebar-muted-foreground", "sidebar-accent", 4.5],
  ["sidebar-accent-foreground", "sidebar-accent", 4.5],
  ["sidebar-primary-foreground", "sidebar-primary", 4.5],
  // Hero: el degradado ya es oscuro y vale en ambos temas.
  ["hero-foreground", "hero-from", 4.5],
  ["hero-foreground", "hero-to", 4.5],
  ["hero-muted-foreground", "hero-from", 4.5],
  ["hero-muted-foreground", "hero-to", 4.5],
  // Semánticos: texto sobre su sólido y sobre su tinta.
  ["success-foreground", "success", 4.5],
  ["success-muted-foreground", "success-muted", 4.5],
  ["warning-foreground", "warning", 4.5],
  ["warning-muted-foreground", "warning-muted", 4.5],
  ["info-foreground", "info", 4.5],
  ["info-muted-foreground", "info-muted", 4.5],
  ["danger-foreground", "danger", 4.5],
  ["danger-muted-foreground", "danger-muted", 4.5],
  ["status-open-foreground", "status-open-muted", 4.5],
  // Badges de las tarjetas móvil de tracking (StatusBadge/SlaBadge): estos
  // pares solo se renderizan en viewport móvil y axe los marcó en CI
  // (tracking @ light). Sin ellos, el unitario daba verde con tokens bajo AA.
  ["status-progress", "status-progress-muted", 4.5],
  ["status-done", "status-done-muted", 4.5],
  ["status-cancelled", "status-cancelled-muted", 4.5],
  ["sla-ok", "sla-ok-muted", 4.5],
  ["sla-risk", "sla-risk-muted", 4.5],
  ["sla-breach", "sla-breach-muted", 4.5],
  // Gráficas sobre la tarjeta (gráficos: 3:1).
  ["chart-1", "card", 3],
  ["chart-2", "card", 3],
  ["chart-3", "card", 3],
  ["chart-4", "card", 3],
  ["chart-5", "card", 3],
];

describe("contraste de tokens", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`AA en tema ${theme}`, () => {
      const failures: string[] = [];
      for (const [fg, bg, min] of PAIRS) {
        const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
        if (ratio < min) {
          failures.push(`${fg}/${bg}: ${ratio.toFixed(2)} < ${min}`);
        }
      }
      expect(failures, `pares bajo AA en ${theme}`).toEqual([]);
    });
  }

  it("el tema opus no reaparece", () => {
    expect(
      CSS.match(/(^|[^\w-])\.opus(?![\w-])/m),
      "sin selector .opus en globals.css",
    ).toBeNull();
  });
});
