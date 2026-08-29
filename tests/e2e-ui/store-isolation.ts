import { existsSync, lstatSync, readdirSync, realpathSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  const environment = Object.prototype.hasOwnProperty.call(options, "environment")
    ? (options.environment ?? {})
    : process.env;
  const externalStoreFile = environment.SIMWAR_PLAYWRIGHT_STORE_FILE;

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
    const { seedR7GoldenM1ScenarioReadinessFixture } =
      await import("./r7-golden-m1-scenario-readiness-fixture");
    seedR7GoldenM1ScenarioReadinessFixture(PLAYWRIGHT_STORE_FILE);
  }
  if (process.env.SIMWAR_PLAYWRIGHT_ROLE_WORKFLOW === "true") {
    const { seedRoleWorkflowFixture } = await import("./role-workflow-fixture");
    seedRoleWorkflowFixture(PLAYWRIGHT_STORE_FILE);
  }
  if (process.env.SIMWAR_PLAYWRIGHT_M2_MARKET_WORLD === "true") {
    const { seedM2MarketWorldProductFixture } = await import("./m2-p1-market-world-fixture");
    seedM2MarketWorldProductFixture(PLAYWRIGHT_STORE_FILE);
  }
  if (process.env.SIMWAR_PLAYWRIGHT_M2_PROJECT_LIBRARY === "true") {
    const { seedM2P2ProjectLibraryFixture } = await import("./m2-p2-project-library-fixture");
    seedM2P2ProjectLibraryFixture(PLAYWRIGHT_STORE_FILE);
  }
  if (process.env.SIMWAR_PLAYWRIGHT_M2_PROJECT_AWARE === "true") {
    const { seedM2P3ProjectAwareLaunchFixture } =
      await import("./m2-p3-project-aware-launch-fixture");
    seedM2P3ProjectAwareLaunchFixture(PLAYWRIGHT_STORE_FILE, { initiallyBlocked: true });
  }
  if (process.env.SIMWAR_PLAYWRIGHT_M2P4 === "true") {
    const { seedM2P4LiveRoundOpsFixture } = await import("./m2-p4-live-round-ops-fixture");
    seedM2P4LiveRoundOpsFixture(PLAYWRIGHT_STORE_FILE);
  }
  if (process.env.SIMWAR_PLAYWRIGHT_M2P5 === "true") {
    const { seedM2P5DecisionLearningFixture } =
      await import("./m2-p5-decision-learning-crossround-fixture");
    await seedM2P5DecisionLearningFixture(PLAYWRIGHT_STORE_FILE);
  }
  if (process.env.SIMWAR_PLAYWRIGHT_TSS === "true") {
    const { seedTeacherScenarioStudioFixture } = await import("./teacher-scenario-studio-fixture");
    await seedTeacherScenarioStudioFixture(PLAYWRIGHT_STORE_FILE);
  }
  if (process.env.SIMWAR_PLAYWRIGHT_RT_O1 === "true") {
    const { seedRegionalTransferFixture } = await import("./regional-transfer-fixture");
    await seedRegionalTransferFixture(PLAYWRIGHT_STORE_FILE);
  }
  if (process.env.SIMWAR_PLAYWRIGHT_M4 === "true") {
    const { seedM4MultipathCounterfactualTransferFixture } =
      await import("./m4-multipath-counterfactual-transfer-fixture");
    await seedM4MultipathCounterfactualTransferFixture(PLAYWRIGHT_STORE_FILE);
  }
  if (process.env.SIMWAR_PLAYWRIGHT_ESL === "true") {
    const { seedM4MultipathCounterfactualTransferFixture } =
      await import("./m4-multipath-counterfactual-transfer-fixture");
    const { createP1Store } = await import("../../services/api/src/store");
    await seedM4MultipathCounterfactualTransferFixture(PLAYWRIGHT_STORE_FILE);
    const store = createP1Store({ persistenceFile: PLAYWRIGHT_STORE_FILE });
    if (
      !store.studentRoleAssignments.some((assignment) => assignment.run_id === "m4-browser-run")
    ) {
      store.studentRoleAssignments.push({
        assignment_id: "m4-browser-assignment-ceo",
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "m4-browser-run",
        team_id: "team_alpha",
        user_id: "usr_student",
        role_key: "CEO",
        role_template_id: "role-template-ceo",
        status: "active",
        source: "teacher_assigned",
        assigned_by: "usr_teacher",
        assigned_at: "2026-08-29T00:00:00.000Z"
      });
      store.persist();
    }
  }
  if (process.env.SIMWAR_PLAYWRIGHT_W3 === "true") {
    const { seedW3OfficialConsequenceFixture } = await import("./w3-official-consequence-fixture");
    seedW3OfficialConsequenceFixture(PLAYWRIGHT_STORE_FILE);
  }
}
