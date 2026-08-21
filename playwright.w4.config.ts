import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testMatch: /w4-(enterprise-state|commercial-visual)\.spec\.ts/,
  testIgnore: undefined,
  outputDir: "tmp/playwright/w4-test-results",
  reporter: [["list"]]
});
