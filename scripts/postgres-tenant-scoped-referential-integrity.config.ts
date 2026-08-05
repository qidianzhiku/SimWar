import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@simwar/shared-contracts": resolve(process.cwd(), "packages/shared-contracts/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["scripts/postgres-tenant-scoped-referential-integrity.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
});
