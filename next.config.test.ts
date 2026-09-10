import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

/**
 * PR2 rename bridges (Cliente → Client / CLIENT → REPORTER).
 *
 * Old addresses keep working while bookmarks and emailed links catch up.
 * Every rule must stay permanent (308) and keep its `:path*` tail, or deep
 * links into the old portal/catalog paths silently land on the wrong page.
 */
describe("next.config redirects (PR2 rename bridges)", () => {
  it("bridges every renamed root, permanently and with its path tail", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual([
      {
        source: "/admin/clientes/:path*",
        destination: "/admin/clients/:path*",
        permanent: true,
      },
      {
        source: "/api/clientes/:path*",
        destination: "/api/clients/:path*",
        permanent: true,
      },
      {
        source: "/client/:path*",
        destination: "/reporter/:path*",
        permanent: true,
      },
    ]);
  });
});
