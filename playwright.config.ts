import { defineConfig, devices } from "@playwright/test";

const apiPort = 3100;
const teacherPort = 3101;
const studentPort = 3102;

export default defineConfig({
  testDir: "./tests/e2e-ui",
  timeout: 60_000,
  outputDir: "test-results/playwright",
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["junit", { outputFile: "test-results/playwright-junit.xml" }]
      ]
    : [["list"]],
  expect: {
    timeout: 10_000
  },
  use: {
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
        "node -e \"require('node:fs').rmSync('services/api/tmp/playwright-store.json',{force:true})\" && npm run dev:api",
      env: {
        API_PORT: `${apiPort}`,
        SIMWAR_STORE_FILE: "tmp/playwright-store.json"
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: `http://127.0.0.1:${apiPort}/healthz`
    },
    {
      command: `npm run dev -w @simwar/teacher -- --host 127.0.0.1 --port ${teacherPort}`,
      env: {
        VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}`
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: `http://127.0.0.1:${teacherPort}`
    },
    {
      command: `npm run dev -w @simwar/student -- --host 127.0.0.1 --port ${studentPort}`,
      env: {
        VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}`
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: `http://127.0.0.1:${studentPort}`
    }
  ]
});
