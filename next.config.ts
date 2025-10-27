import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb", // Or any desired limit like '1000kb', '2mb', etc.
    },
  },
};

export default nextConfig;
