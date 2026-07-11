import { rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedR7GoldenM1ScenarioReadinessFixture } from "./r7-golden-m1-scenario-readiness-fixture";

const modulePath = fileURLToPath(import.meta.url);
const moduleDir = dirname(modulePath);
const repositoryRoot = resolve(moduleDir, "../..");
const apiTmpDir = resolve(repositoryRoot, "services/api/tmp");

export const PLAYWRIGHT_STORE_FILE = resolve(apiTmpDir, "playwright-store.json");

export function assertPlaywrightStoreFile(storeFile = PLAYWRIGHT_STORE_FILE): string {
  const resolvedStoreFile = resolve(storeFile);

  if (dirname(resolvedStoreFile) !== apiTmpDir) {
    throw new Error(`Refusing to remove Playwright store outside API tmp: ${resolvedStoreFile}`);
  }

  if (basename(resolvedStoreFile) !== "playwright-store.json") {
    throw new Error(`Refusing to remove unexpected Playwright store file: ${resolvedStoreFile}`);
  }

  return resolvedStoreFile;
}

export function cleanupPlaywrightStore(storeFile = PLAYWRIGHT_STORE_FILE): void {
  rmSync(assertPlaywrightStoreFile(storeFile), { force: true });
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  cleanupPlaywrightStore();
  if (process.env.SIMWAR_PLAYWRIGHT_GOLDEN_M1 === "true") {
    seedR7GoldenM1ScenarioReadinessFixture(PLAYWRIGHT_STORE_FILE);
  }
}
