import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const webServer = baseConfig.webServer?.map((server, index) =>
  index === 0
    ? {
        ...server,
        env: {
          ...server.env,
          SIMWAR_PLAYWRIGHT_RT_O1: "true",
          SIMWAR_PLAYWRIGHT_W3: "false"
        }
      }
    : server
);

export default defineConfig({
  ...baseConfig,
  testDir: "./tests/e2e-ui",
  testIgnore: undefined,
  testMatch: /regional-transfer-product-journey\.spec\.ts/,
  webServer
});
