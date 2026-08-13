import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testMatch: /pr4-.*\.spec\.ts/,
  outputDir: "tmp/pr4-playwright/test-results",
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "tmp/pr4-playwright/report" }],
        ["junit", { outputFile: "tmp/pr4-playwright/playwright-junit.xml" }]
      ]
    : [["list"]],
  use: {
    ...baseConfig.use,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  }
});
