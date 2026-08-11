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
};

export default nextConfig;
