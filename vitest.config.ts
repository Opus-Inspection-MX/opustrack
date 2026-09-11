import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Root `resolve.alias` is NOT inherited by inline `test.projects`
// (verified: "@" fails to resolve otherwise), so every project declares
// the alias itself through the project-aware `test.alias`.
const alias = {
  "@": path.resolve(__dirname, "./src"),
};

export default defineConfig({
  test: {
    // Two projects, one runner. Root Vite options (plugins, resolve) are
    // NOT inherited by inline projects (verified), so each project declares
    // its own; likewise array options would merge from root, so
    // per-project settings live ONLY here besides coverage.
    projects: [
      {
        plugins: [react()],
        test: {
          name: "unit",
          alias,
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
          // Playwright owns e2e/**/*.spec.ts. Everything else under e2e/
          // (pure helpers such as fixtures/ephemeral-db.ts) is unit-tested
          // here. Integration tests are a separate project below.
          exclude: [
            "node_modules",
            "dist",
            ".next",
            "e2e/**/*.spec.ts",
            "**/*.int.test.ts",
          ],
        },
      },
      {
        test: {
          name: "integration",
          alias,
          environment: "node",
          globals: true,
          setupFiles: ["./src/test/integration/setup.ts"],
          include: ["src/test/integration/**/*.int.test.ts"],
          // Every file shares one ephemeral Postgres: sequential files,
          // generous timeout for migrate/seed-adjacent work.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
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
      // The 75% bar guards the mocked unit suite (`--project unit`).
      // Integration tests hit a real database and are excluded above.
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
