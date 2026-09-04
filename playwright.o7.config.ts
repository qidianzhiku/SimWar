import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const servers = Array.isArray(base.webServer) ? base.webServer : [base.webServer!];

export default defineConfig({
  ...base,
  testDir: "./tests/e2e-o7",
  testMatch: "*.spec.ts",
  testIgnore: [],
  timeout: 120_000,
  outputDir: "tmp/playwright-o7/test-results",
  use: { ...base.use, trace: "on", screenshot: "on" },
  webServer: [
    { ...servers[0]!, command: "node --import tsx tests/e2e-o6/server.ts" },
    ...servers.slice(1)
  ]
});
