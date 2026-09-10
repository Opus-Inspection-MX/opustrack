import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the Docker image sets NEXT_OUTPUT, so Vercel's build is unchanged:
  // it never defines the variable and this stays undefined. Setting
  // `standalone` unconditionally would alter what Vercel produces.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    serverActions: {
      // 10MB per-file cap is enforced in actions; allow headroom for multipart
      // boundaries + other form fields so a max-size file still fits.
      bodySizeLimit: "12mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
  /**
   * PR2 rename bridges (Cliente → Client / CLIENT → REPORTER).
   *
   * Old portal and catalog paths stay reachable while bookmarks, emailed
   * links, and cached redirects catch up. Permanent (308) so browsers and
   * search engines retire the old addresses; the app itself never links to
   * them anymore. Remove once traffic to the sources stops — there is a
   * unit test pinning this list (`next.config.test.ts`).
   */
  async redirects() {
    return [
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
    ];
  },
};

export default nextConfig;
