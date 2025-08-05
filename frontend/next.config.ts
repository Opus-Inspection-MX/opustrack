import type { NextConfig } from "next";
const path = require("path");
// 1) Opción con dotenv:
require("dotenv").config({
  // Apunta al .env de la raíz del monorepo
  path: path.resolve(__dirname, "../", `.env.${process.env.NODE_ENV}`),
  override: true, // fuerza reemplazar cualquier variable duplicada
});

const nextConfig: NextConfig = {
  env: {
    // si quieres exponer algunas vars al cliente:
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    // …otras vars públicas…
  },
  /* config options here */
};

export default nextConfig;
