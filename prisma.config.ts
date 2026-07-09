import path from "node:path";
import type { PrismaConfig } from "prisma";

export default {
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    // Real initial-load seed (gitignored). Template: initial_load/seed.example.ts
    seed: "tsx initial_load/seed.ts",
  },
} satisfies PrismaConfig;
