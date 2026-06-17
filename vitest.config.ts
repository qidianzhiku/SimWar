import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@simwar/shared-contracts": resolve(__dirname, "packages/shared-contracts/src/index.ts")
    }
  },
  test: {
    environment: "node",
    env: {
      APP_ENV: "test",
      INTERNAL_SERVICE_TOKEN: "test-internal-service-token",
      JWT_SECRET: "test-jwt-secret-with-sufficient-length"
    },
    include: ["tests/**/*.test.ts"]
  }
});
