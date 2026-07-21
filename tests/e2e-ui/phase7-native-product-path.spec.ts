import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page
} from "@playwright/test";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { resolveApiHost } from "../../services/api/src/server";
import {
  LEGACY_PLAYWRIGHT_STORE_FILE,
  assertPlaywrightStoreFile,
  cleanupPlaywrightStore,
  resolvePlaywrightStoreFile
} from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const sourcePath = fileURLToPath(import.meta.url);
const privateMarkers = [
  "state_true",
  "ReplayManifest",
  "canonical_evidence_digest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "private ParameterSet",
  "private Replay"
];

type Credentials = {
  password: string;
  username: string;
};

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  cleanupPlaywrightStore();
});

test("@foundation preserves the legacy Store when no override is configured", () => {
  expect(resolvePlaywrightStoreFile({ environment: {} })).toBe(LEGACY_PLAYWRIGHT_STORE_FILE);
});

test("@foundation accepts the exact legacy Store override", () => {
  expect(
    resolvePlaywrightStoreFile({
      environment: { SIMWAR_PLAYWRIGHT_STORE_FILE: LEGACY_PLAYWRIGHT_STORE_FILE }
    })
  ).toBe(LEGACY_PLAYWRIGHT_STORE_FILE);
});

test("@foundation accepts one controlled external Store path and removes only its file", () => {
  const missionId = `phase7-native-validation-${process.pid}-${Date.now()}`;
  const controlledRoot = resolve(tmpdir(), "simwar-playwright");
  const missionDirectory = resolve(controlledRoot, missionId);
  const storeFile = resolve(missionDirectory, "playwright-store.json");

  try {
    expect(
      resolvePlaywrightStoreFile({
        environment: { SIMWAR_PLAYWRIGHT_STORE_FILE: storeFile }
      })
    ).toBe(storeFile);

    mkdirSync(dirname(storeFile), { recursive: true });
    cleanupPlaywrightStore(storeFile);

    expect(existsSync(storeFile)).toBe(false);
    expect(existsSync(missionDirectory)).toBe(false);
    expect(existsSync(controlledRoot)).toBe(true);
  } finally {
    cleanupPlaywrightStore(storeFile);
  }
});

test("@foundation rejects unsafe Store paths before cleanup", () => {
  const isolatedTemp = mkdtempSync(join(tmpdir(), "simwar-playwright-test-"));
  const controlledRoot = resolve(isolatedTemp, "simwar-playwright");
  const validMissionDirectory = resolve(controlledRoot, "phase7-native-validation");
  const validStoreFile = resolve(validMissionDirectory, "playwright-store.json");
  const outsideFile = resolve(isolatedTemp, "outside-store.json");

  try {
    mkdirSync(validMissionDirectory, { recursive: true });
    for (const storeFile of [
      "playwright-store.json",
      `${validMissionDirectory}\\..\\escaped\\playwright-store.json`,
      resolve(isolatedTemp, "playwright-store.json"),
      resolve(validMissionDirectory, "unexpected.json")
    ]) {
      expect(() =>
        resolvePlaywrightStoreFile({
          environment: { SIMWAR_PLAYWRIGHT_STORE_FILE: storeFile },
          tempDirectory: isolatedTemp
        })
      ).toThrow();
    }

    expect(() => assertPlaywrightStoreFile(outsideFile)).toThrow();
    expect(
      resolvePlaywrightStoreFile({
        environment: { SIMWAR_PLAYWRIGHT_STORE_FILE: validStoreFile },
        tempDirectory: isolatedTemp
      })
    ).toBe(validStoreFile);
  } finally {
    rmSync(isolatedTemp, { force: true, recursive: true });
  }
});

test("@foundation rejects a symbolic-link mission directory", () => {
  const isolatedTemp = mkdtempSync(join(tmpdir(), "simwar-playwright-test-"));
  const controlledRoot = resolve(isolatedTemp, "simwar-playwright");
  const outsideDirectory = resolve(isolatedTemp, "outside");
  const linkedMissionDirectory = resolve(controlledRoot, "phase7-native-validation");

  try {
    mkdirSync(controlledRoot, { recursive: true });
    mkdirSync(outsideDirectory, { recursive: true });
    symlinkSync(outsideDirectory, linkedMissionDirectory, "junction");

    expect(lstatSync(linkedMissionDirectory).isSymbolicLink()).toBe(true);
    expect(() =>
      resolvePlaywrightStoreFile({
        environment: {
          SIMWAR_PLAYWRIGHT_STORE_FILE: resolve(linkedMissionDirectory, "playwright-store.json")
        },
        tempDirectory: isolatedTemp
      })
    ).toThrow("symbolic link");
  } finally {
    rmSync(isolatedTemp, { force: true, recursive: true });
  }
});

test("@foundation keeps API host opt-in and the native spec free of forbidden paths", () => {
  expect(resolveApiHost(undefined)).toBeUndefined();
  expect(resolveApiHost(" 127.0.0.1 ")).toBe("127.0.0.1");
  expect(resolveApiHost("0.0.0.0")).toBe("0.0.0.0");

  const source = readFileSync(sourcePath, "utf8");
  const directStoreMarker = ["services", "api", "tmp"].join("/");
  const internalRouteMarker = ["/", "internal", "/v1"].join("");
  const tempOrchestratorMarker = ["phase7", "formal", "orchestrator"].join("-");
  const tempAdapterMarker = ["browser", "adapter", "r4"].join("-");

  expect(source).not.toContain(directStoreMarker);
  expect(source).not.toContain(internalRouteMarker);
  expect(source).not.toContain(tempOrchestratorMarker);
  expect(source).not.toContain(tempAdapterMarker);
});

async function apiPost<TData>(
  request: APIRequestContext,
  path: string,
  token: string | undefined,
  body: unknown
): Promise<ApiEnvelope<TData>> {
  const response = await request.post(`${apiBaseUrl}${path}`, {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiEnvelope<TData>;
}

async function login(request: APIRequestContext, credentials: Credentials): Promise<string> {
  const envelope = await apiPost<AuthSession>(
    request,
    "/api/v1/auth/login",
    undefined,
    credentials
  );
  return envelope.data.access_token;
}

async function signIn(
  page: Page,
  role: "管理员登录" | "教师登录" | "学员登录",
  credentials: Credentials
): Promise<void> {
  const scope = role === "管理员登录" ? page.locator('section[aria-label="admin login"]') : page;
  await scope.getByLabel("tenant").fill("tenant_demo");
  await scope.getByLabel("username").fill(credentials.username);
  await scope.getByLabel("password").fill(credentials.password);
  await scope.getByRole("button", { name: role }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function createStudentBThroughAdminUi(page: Page, credentials: Credentials): Promise<string> {
  const form = page.locator("article", { has: page.getByRole("heading", { name: "创建用户" }) });
  await form.getByLabel("用户名").fill(credentials.username);
  await form.getByLabel("邮箱").fill(`${credentials.username}@demo.simwar.local`);
  await form.getByLabel("显示名").fill("Phase 7 Student B");
  await form.getByLabel("初始密码").fill(credentials.password);
  await form.getByLabel("角色").selectOption("learner");
  await form.getByRole("button", { name: "创建用户" }).click();

  const notice = page.locator(".notice");
  await expect(notice).toContainText("user created:");
  const created = await notice.innerText();
  const userId = created.replace("user created:", "").trim();
  expect(userId).toMatch(/^usr_/);
  return userId;
}

function watchPublicRequests(context: BrowserContext, requests: string[]): void {
  context.on("request", (request) => {
    if (request.url().startsWith(apiBaseUrl)) {
      requests.push(request.url());
    }
  });
}

async function closeContexts(contexts: BrowserContext[]): Promise<void> {
  await Promise.all(contexts.map((context) => context.close()));
}

test("@phase7 executes the serial two-Run product path only under its exact gate", async ({
  browser,
  request
}, testInfo) => {
  test.skip(
    process.env.SIMWAR_PHASE7_NATIVE_VALIDATION !== "true",
    "full Phase 7 product validation requires a separate explicit authorization"
  );

  const suffix = `${testInfo.workerIndex}-${Date.now()}`;
  const teacherCredentials = { username: "teacher", password: "teacher" };
  const adminCredentials = { username: "admin", password: "admin" };
  const studentACredentials = { username: "student", password: "student" };
  const studentBCredentials = {
    username: `phase7-student-b-${suffix}`,
    password: `phase7-${suffix}-synthetic`
  };
  const contexts: BrowserContext[] = [];
  const observedRequests: string[] = [];

  try {
    const teacherContext = await browser.newContext();
    const studentAContext = await browser.newContext();
    const studentBContext = await browser.newContext();
    const adminContext = await browser.newContext();
    contexts.push(teacherContext, studentAContext, studentBContext, adminContext);
    for (const context of contexts) watchPublicRequests(context, observedRequests);

    const teacherPage = await teacherContext.newPage();
    const studentAPage = await studentAContext.newPage();
    const studentBPage = await studentBContext.newPage();
    const adminPage = await adminContext.newPage();

    await test.step("baseline and allowlisted public fixture setup", async () => {
      await adminPage.goto(adminBaseUrl);
      await signIn(adminPage, "管理员登录", adminCredentials);
      const studentBUserId = await createStudentBThroughAdminUi(adminPage, studentBCredentials);

      const teacherToken = await login(request, teacherCredentials);
      const teamEnvelope = await apiPost<{ team_id: string }>(
        request,
        "/api/v1/courses/course_demo/teams",
        teacherToken,
        { captain_user_id: studentBUserId, name: "Phase 7 Team B" }
      );
      expect(teamEnvelope.data.team_id).toMatch(/^team_/);
    });

    await test.step("Run A is created and opened through the Teacher product surface", async () => {
      await teacherPage.goto(teacherBaseUrl);
      await signIn(teacherPage, "教师登录", teacherCredentials);
      await teacherPage.getByRole("button", { name: "创建 Run" }).click();
      await expect(teacherPage.getByText("run created")).toBeVisible();
      await teacherPage.getByRole("button", { name: "开启回合" }).click();
      await expect(teacherPage.getByText("round opened")).toBeVisible();
    });

    await test.step("two Student product surfaces submit their assigned team decisions", async () => {
      await studentAPage.goto(studentBaseUrl);
      await signIn(studentAPage, "学员登录", studentACredentials);
      await studentAPage.getByRole("button", { name: "提交决策" }).click();
      await expect(studentAPage.getByText("decision submitted")).toBeVisible();

      await studentBPage.goto(studentBaseUrl);
      await signIn(studentBPage, "学员登录", studentBCredentials);
      await studentBPage.getByRole("button", { name: "提交决策" }).click();
      await expect(studentBPage.getByText("decision submitted")).toBeVisible();
    });

    await test.step("Teacher locks, settles, and publishes Run A once", async () => {
      await teacherPage.reload();
      await signIn(teacherPage, "教师登录", teacherCredentials);
      await teacherPage.getByRole("button", { name: "锁定回合" }).click();
      await expect(teacherPage.getByText("round locked")).toBeVisible();
      await teacherPage.getByRole("button", { name: "请求结算" }).click();
      await expect(teacherPage.getByText("settlement completed")).toBeVisible();
      await teacherPage.getByRole("button", { name: "发布结果" }).click();
      await expect(teacherPage.getByText("result published")).toBeVisible();
      await expect(teacherPage.getByRole("heading", { name: "BFF Replay 摘要" })).toBeVisible();
    });

    await test.step("results, feedback, learning evidence, and tenant scope stay product-safe", async () => {
      for (const page of [studentAPage, studentBPage]) {
        await page.reload();
        await signIn(
          page,
          "学员登录",
          page === studentAPage ? studentACredentials : studentBCredentials
        );
        await expect(page.getByRole("heading", { name: "BFF 发布结果" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "三段式反馈" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Learning Report" })).toBeVisible();
        const text = await page.locator("body").innerText();
        for (const marker of privateMarkers) expect(text).not.toContain(marker);
      }

      await expect(teacherPage.getByText("formal_truth_write_allowed: false")).toBeVisible();
      await expect(teacherPage.getByRole("heading", { name: "课堂复盘材料" })).toBeVisible();
      await expect(adminPage.getByLabel("tenant admin scoped summary")).toBeVisible();
      await expect(adminPage.getByText("Other Tenant")).toHaveCount(0);
      await testInfo.attach("phase7-run-a-product-evidence", {
        body: Buffer.from(JSON.stringify({ state: "PUBLISHED", surface: "public-product-only" })),
        contentType: "application/json"
      });
    });

    await test.step("Run B uses the separate pre-settlement lifecycle product path", async () => {
      await teacherPage.getByRole("button", { name: "Create Next Run" }).click();
      await expect(teacherPage.getByText("run created")).toBeVisible();
      const runBId = await teacherPage.getByLabel("run selector").inputValue();
      expect(runBId).toMatch(/^run_/);

      await adminPage.reload();
      await signIn(adminPage, "管理员登录", adminCredentials);
      const lifecycleSurface = adminPage.getByLabel("synthetic run lifecycle controls");
      const runB = lifecycleSurface.locator("article", { hasText: runBId });
      await expect(runB.getByText("ACTIVE", { exact: true })).toBeVisible();
      adminPage.on("dialog", (dialog) => dialog.accept());

      await runB.getByRole("button", { name: "ABORT" }).click();
      await expect(runB.getByText("ABORTED", { exact: true })).toBeVisible();
      await runB.getByRole("button", { name: "RESET" }).click();
      await expect(runB.getByText("RESET_READY", { exact: true })).toBeVisible();
      await runB.getByRole("button", { name: "ABORT" }).click();
      await expect(runB.getByText("ABORTED", { exact: true })).toBeVisible();
      await runB.getByRole("button", { name: "CLEANUP" }).click();
      await expect(runB.getByText("CLEANED", { exact: true })).toBeVisible();
    });

    expect(observedRequests.some((url) => url.includes("/internal/"))).toBe(false);
  } finally {
    await closeContexts(contexts);
  }
});
