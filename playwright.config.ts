import { defineConfig, devices } from "@playwright/test";
import { resolvePlaywrightStoreFile } from "./tests/e2e-ui/store-isolation";

const apiPort = Number(process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100);
const adminPort = Number(process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103);
const teacherPort = Number(process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101);
const studentPort = Number(process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102);
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const adminBaseUrl = `http://127.0.0.1:${adminPort}`;
const teacherBaseUrl = `http://127.0.0.1:${teacherPort}`;
const studentBaseUrl = `http://127.0.0.1:${studentPort}`;
const phase7NativeValidation = process.env.SIMWAR_PHASE7_NATIVE_VALIDATION === "true";
const playwrightStoreFile = resolvePlaywrightStoreFile();

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
    trace: phase7NativeValidation ? "off" : "retain-on-failure",
    video: phase7NativeValidation ? "off" : undefined
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
        API_HOST: "127.0.0.1",
        INTERNAL_SERVICE_TOKEN: "playwright-internal-service-token",
        JWT_SECRET: "playwright-jwt-secret-with-sufficient-length",
        SIMWAR_ENV: "test",
        SIMWAR_PLAYWRIGHT_STORE_FILE: playwrightStoreFile,
        SIMWAR_STORE_FILE: playwrightStoreFile
      },
      reuseExistingServer: false,
      timeout: 180_000,
      url: `${apiBaseUrl}/healthz`
    },
    {
      command: `npm run dev -w @simwar/admin -- --host 127.0.0.1 --port ${adminPort}`,
      env: {
        VITE_API_BASE_URL: apiBaseUrl
      },
      reuseExistingServer: false,
      timeout: 180_000,
      url: adminBaseUrl
    },
    {
      command: `npm run dev -w @simwar/teacher -- --host 127.0.0.1 --port ${teacherPort}`,
      env: {
        VITE_API_BASE_URL: apiBaseUrl
      },
      reuseExistingServer: false,
      timeout: 180_000,
      url: teacherBaseUrl
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
