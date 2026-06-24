import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const apiPort = 3100;
const studentPort = 3102;
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const studentBaseUrl = `http://127.0.0.1:${studentPort}`;
const playwrightStoreFile = resolve("services/api/tmp/playwright-store.json");

export default defineConfig({
  testDir: "./tests/e2e-ui",
  fullyParallel: false,
  timeout: 60_000,
  workers: 1,
  outputDir: "tmp/playwright/test-results",
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "tmp/playwright/report" }],
        ["junit", { outputFile: "tmp/playwright/playwright-junit.xml" }]
      ]
    : [["list"]],
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: studentBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command:
        "npm run build -w @simwar/shared-contracts && npm run build -w @simwar/simulation-core && node --import tsx tests/e2e-ui/store-isolation.ts && npm run dev:api",
      env: {
        API_PORT: `${apiPort}`,
        INTERNAL_SERVICE_TOKEN: "playwright-internal-service-token",
        JWT_SECRET: "playwright-jwt-secret-with-sufficient-length",
        SIMWAR_ENV: "test",
        SIMWAR_STORE_FILE: playwrightStoreFile
      },
      reuseExistingServer: false,
      timeout: 180_000,
      url: `${apiBaseUrl}/healthz`
    },
    {
      command: `npm run dev -w @simwar/student -- --host 127.0.0.1 --port ${studentPort}`,
      env: {
        VITE_API_BASE_URL: apiBaseUrl
      },
      reuseExistingServer: false,
      timeout: 180_000,
      url: studentBaseUrl
    }
  ]
});
