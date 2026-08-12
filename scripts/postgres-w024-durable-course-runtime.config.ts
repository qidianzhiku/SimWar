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
    include: ["scripts/postgres-w024-durable-course-runtime.test.ts"],
    hookTimeout: 120_000,
    testTimeout: 120_000
  }
});
