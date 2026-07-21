import { existsSync, lstatSync, readdirSync, realpathSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedR7GoldenM1ScenarioReadinessFixture } from "./r7-golden-m1-scenario-readiness-fixture";

const modulePath = fileURLToPath(import.meta.url);
const moduleDir = dirname(modulePath);
const repositoryRoot = resolve(moduleDir, "../..");
const apiTmpDir = resolve(repositoryRoot, "services/api/tmp");
const EXTERNAL_STORE_ROOT_NAME = "simwar-playwright";
const MISSION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,80}$/;
const STORE_FILE_NAME = "playwright-store.json";

export const LEGACY_PLAYWRIGHT_STORE_FILE = resolve(apiTmpDir, STORE_FILE_NAME);

export interface PlaywrightStoreResolutionOptions {
  environment?: NodeJS.ProcessEnv;
  tempDirectory?: string;
}

function externalStoreRoot(tempDirectory: string): string {
  return resolve(tempDirectory, EXTERNAL_STORE_ROOT_NAME);
}

function assertExternalStorePath(storeFile: string, tempDirectory: string): string {
  const root = externalStoreRoot(tempDirectory);
  const resolvedStoreFile = resolve(storeFile);
  const pathFromRoot = relative(root, resolvedStoreFile);
  const pathSegments = pathFromRoot.split(/[\\/]/);

  if (
    pathSegments.length !== 2 ||
    pathSegments[0] === ".." ||
    !MISSION_ID_PATTERN.test(pathSegments[0] ?? "") ||
    pathSegments[1] !== STORE_FILE_NAME
  ) {
    throw new Error("Playwright store must be inside the controlled temporary root");
  }

  const missionDirectory = dirname(resolvedStoreFile);
  for (const path of [root, missionDirectory, resolvedStoreFile]) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
      throw new Error(`Refusing symbolic link in Playwright Store path: ${path}`);
    }
  }

  if (existsSync(missionDirectory)) {
    const realRoot = realpathSync(root);
    const realMissionDirectory = realpathSync(missionDirectory);
    if (relative(realRoot, realMissionDirectory) !== pathSegments[0]) {
      throw new Error("Playwright Store resolves outside the controlled temporary root");
    }
  }

  return resolvedStoreFile;
}

export function resolvePlaywrightStoreFile(options: PlaywrightStoreResolutionOptions = {}): string {
  const externalStoreFile =
    options.environment?.SIMWAR_PLAYWRIGHT_STORE_FILE ?? process.env.SIMWAR_PLAYWRIGHT_STORE_FILE;

  const trimmedStoreFile = externalStoreFile?.trim();
  if (!trimmedStoreFile) {
    return LEGACY_PLAYWRIGHT_STORE_FILE;
  }

  if (trimmedStoreFile.split(/[\\/]/).includes("..")) {
    throw new Error("Playwright Store override must not contain path traversal");
  }

  if (resolve(trimmedStoreFile) === LEGACY_PLAYWRIGHT_STORE_FILE) {
    return LEGACY_PLAYWRIGHT_STORE_FILE;
  }

  if (!isAbsolute(trimmedStoreFile)) {
    throw new Error("Playwright Store override must be an absolute path");
  }

  return assertExternalStorePath(trimmedStoreFile, options.tempDirectory ?? tmpdir());
}

export const PLAYWRIGHT_STORE_FILE = resolvePlaywrightStoreFile();

export function assertPlaywrightStoreFile(storeFile = PLAYWRIGHT_STORE_FILE): string {
  const resolvedStoreFile = resolve(storeFile);

  if (resolvedStoreFile === LEGACY_PLAYWRIGHT_STORE_FILE) {
    return resolvedStoreFile;
  }

  if (basename(resolvedStoreFile) !== STORE_FILE_NAME) {
    throw new Error(`Refusing to remove unexpected Playwright store file: ${resolvedStoreFile}`);
  }

  return assertExternalStorePath(resolvedStoreFile, tmpdir());
}

export function cleanupPlaywrightStore(storeFile = PLAYWRIGHT_STORE_FILE): void {
  const resolvedStoreFile = assertPlaywrightStoreFile(storeFile);
  rmSync(resolvedStoreFile, { force: true });

  if (resolvedStoreFile === LEGACY_PLAYWRIGHT_STORE_FILE) {
    return;
  }

  const missionDirectory = dirname(resolvedStoreFile);
  if (existsSync(missionDirectory) && readdirSync(missionDirectory).length === 0) {
    rmdirSync(missionDirectory);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  cleanupPlaywrightStore();
  if (process.env.SIMWAR_PLAYWRIGHT_GOLDEN_M1 === "true") {
    seedR7GoldenM1ScenarioReadinessFixture(PLAYWRIGHT_STORE_FILE);
  }
}
