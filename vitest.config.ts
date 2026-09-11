import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    // Playwright owns e2e/**/*.spec.ts. Everything else under e2e/ (pure
    // helpers such as fixtures/ephemeral-db.ts) is unit-tested here.
    // TODO(promote): Fase 2 splits unit/integration into test.projects with
    // a real Postgres stack; until then *.int.test.ts stays out of the unit
    // run and is exercised manually against the local container.
    exclude: [
      "node_modules",
      "dist",
      ".next",
      "e2e/**/*.spec.ts",
      "**/*.int.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mockData.ts",
        ".next/",
        "dist/",
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
