import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every page is authenticated somewhere.
 *
 * Portal layouts (`/admin`, `/fsr`, `/reporter`, `/guest`, `/vacations`,
 * `/profile`) carry the coarse `requireRouteAccess("<portal>")` gate, so a
 * page under one of them is covered even without its own guard. Pages outside
 * a guarded portal — and the public pages anyone may open — are enumerated
 * explicitly below. A new portal or a new public page must update this test,
 * which is the point: an unguarded page should be a conscious decision, not
 * a forgotten import.
 */

const APP_DIR = join(process.cwd(), "src/app");

/** Portals whose `layout.tsx` carries `requireRouteAccess("<portal>")`. */
const GUARDED_PORTALS = [
  "admin",
  "fsr",
  "reporter",
  "guest",
  "vacations",
  "profile",
] as const;

/**
 * Pages reachable without a session. Mirrors `isPublicRoute` in
 * `src/lib/authz/route-access.ts` plus the `/` landing page, which redirects
 * by session state instead of guarding.
 */
const PUBLIC_PAGES = new Set([
  "src/app/page.tsx",
  "src/app/login/page.tsx",
  "src/app/signup/page.tsx",
  "src/app/logout/page.tsx",
  "src/app/unauthorized/page.tsx",
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

function portalOf(pageFile: string): string | null {
  const rel = relative(APP_DIR, pageFile);
  const first = rel.split("/")[0];
  return first && first !== "page.tsx" ? first : null;
}

describe("portal layout guards", () => {
  it("every guarded portal layout calls requireRouteAccess", () => {
    const missing: string[] = [];
    for (const portal of GUARDED_PORTALS) {
      const source = readFileSync(join(APP_DIR, portal, "layout.tsx"), "utf8");
      if (!source.includes("requireRouteAccess")) missing.push(portal);
    }
    expect(missing, "Portal layouts without a route guard").toEqual([]);
  });

  it("every page is covered by a layout guard, its own guard, or the public list", () => {
    const uncovered: string[] = [];
    for (const pageFile of walk(APP_DIR)) {
      const rel = relative(process.cwd(), pageFile);
      if (PUBLIC_PAGES.has(rel)) continue;
      const portal = portalOf(pageFile);
      if (portal && (GUARDED_PORTALS as readonly string[]).includes(portal)) {
        continue;
      }
      const source = readFileSync(pageFile, "utf8");
      if (!source.includes("requireRouteAccess")) uncovered.push(rel);
    }
    expect(
      uncovered,
      "Pages with no layout guard and no own requireRouteAccess — " +
        "add the page to a guarded portal, call requireRouteAccess, or " +
        "justify it in PUBLIC_PAGES.",
    ).toEqual([]);
  });

  it("the public list stays honest", () => {
    // A public entry that no longer exists is a stale excuse — remove it.
    const stale = [...PUBLIC_PAGES].filter((rel) => {
      try {
        statSync(join(process.cwd(), rel));
        return false;
      } catch {
        return true;
      }
    });
    expect(stale, "Stale PUBLIC_PAGES entries").toEqual([]);
  });
});
