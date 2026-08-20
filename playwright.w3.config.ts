import { defineConfig, devices } from "@playwright/test";
import { resolvePlaywrightStoreFile } from "./tests/e2e-ui/store-isolation";

const apiPort = Number(process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100);
const teacherPort = Number(process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101);
const studentPort = Number(process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102);
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const playwrightStoreFile = resolvePlaywrightStoreFile();

export default defineConfig({
  testDir: "./tests/e2e-ui",
  testMatch: /w3-official-consequence-learning\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: studentPort ? `http://127.0.0.1:${studentPort}` : undefined
  },
  webServer: [
    {
      command:
        "npm run build -w @simwar/shared-contracts && npm run build -w @simwar/simulation-core && node --import tsx tests/e2e-ui/store-isolation.ts && npm run dev:api",
      env: {
        API_HOST: "127.0.0.1",
        API_PORT: `${apiPort}`,
        INTERNAL_SERVICE_TOKEN: "playwright-internal-service-token",
        JWT_SECRET: "playwright-jwt-secret-with-sufficient-length",
        SIMWAR_ENV: "test",
        SIMWAR_PLAYWRIGHT_STORE_FILE: playwrightStoreFile,
        SIMWAR_PLAYWRIGHT_W3: "true",
        SIMWAR_STORE_FILE: playwrightStoreFile
      },
      reuseExistingServer: false,
      timeout: 180_000,
      url: `${apiBaseUrl}/healthz`
    },
    {
      command: `npm run dev -w @simwar/teacher -- --host 127.0.0.1 --port ${teacherPort}`,
      env: { VITE_API_BASE_URL: apiBaseUrl, VITE_SIMWAR_W3_ENABLED: "true" },
      reuseExistingServer: false,
      timeout: 180_000,
      url: `http://127.0.0.1:${teacherPort}`
    },
    {
      command: `npm run dev -w @simwar/student -- --host 127.0.0.1 --port ${studentPort}`,
      env: { VITE_API_BASE_URL: apiBaseUrl, VITE_SIMWAR_W3_ENABLED: "true" },
      reuseExistingServer: false,
      timeout: 180_000,
      url: `http://127.0.0.1:${studentPort}`
    }
  ]
});
