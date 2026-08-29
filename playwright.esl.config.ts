import { defineConfig, devices } from "@playwright/test";
import { resolvePlaywrightStoreFile } from "./tests/e2e-ui/store-isolation";

const apiPort = Number(process.env.SIMWAR_PLAYWRIGHT_ESL_API_PORT ?? 3110);
const adminPort = Number(process.env.SIMWAR_PLAYWRIGHT_ESL_ADMIN_PORT ?? 3113);
const teacherPort = Number(process.env.SIMWAR_PLAYWRIGHT_ESL_TEACHER_PORT ?? 3111);
const studentPort = Number(process.env.SIMWAR_PLAYWRIGHT_ESL_STUDENT_PORT ?? 3112);
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const adminBaseUrl = `http://127.0.0.1:${adminPort}`;
const teacherBaseUrl = `http://127.0.0.1:${teacherPort}`;
const studentBaseUrl = `http://127.0.0.1:${studentPort}`;
const storeFile = resolvePlaywrightStoreFile();

export default defineConfig({
  testDir: "./tests/e2e-ui",
  testMatch: /executive-strategy-lab\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  outputDir: "tmp/playwright/esl-test-results",
  reporter: process.env.CI
    ? [["github"], ["junit", { outputFile: "tmp/playwright/esl-junit.xml" }]]
    : [["list"]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: studentBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"]
  },
  webServer: [
    {
      command:
        "npm run build:test-prerequisites && node --import tsx tests/e2e-ui/store-isolation.ts && npm run dev:api",
      env: {
        API_PORT: `${apiPort}`,
        API_HOST: "127.0.0.1",
        INTERNAL_SERVICE_TOKEN: "playwright-esl-internal-service-token",
        JWT_SECRET: "playwright-esl-jwt-secret-with-sufficient-length",
        SIMWAR_ENV: "test",
        SIMWAR_PLAYWRIGHT_ESL: "true",
        SIMWAR_PLAYWRIGHT_STORE_FILE: storeFile,
        SIMWAR_STORE_FILE: storeFile
      },
      reuseExistingServer: false,
      timeout: 180_000,
      url: `${apiBaseUrl}/healthz`
    },
    {
      command: `npm run dev -w @simwar/admin -- --host 127.0.0.1 --port ${adminPort}`,
      env: { VITE_API_BASE_URL: apiBaseUrl },
      reuseExistingServer: false,
      timeout: 180_000,
      url: adminBaseUrl
    },
    {
      command: `npm run dev -w @simwar/teacher -- --host 127.0.0.1 --port ${teacherPort}`,
      env: { VITE_API_BASE_URL: apiBaseUrl },
      reuseExistingServer: false,
      timeout: 180_000,
      url: teacherBaseUrl
    },
    {
      command: `npm run dev -w @simwar/student -- --host 127.0.0.1 --port ${studentPort}`,
      env: { VITE_API_BASE_URL: apiBaseUrl },
      reuseExistingServer: false,
      timeout: 180_000,
      url: studentBaseUrl
    }
  ]
});
