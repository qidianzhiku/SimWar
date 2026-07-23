import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { PLAYWRIGHT_STORE_FILE, cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const commonKnownLimitIds = [
  "JSON_INTERNAL_ONLY",
  "SYNTHETIC_ONLY",
  "LOOPBACK_ONLY",
  "POSTGRESQL_NOT_ACTIVE",
  "DURABLE_SETTLEMENT_NOT_PROVEN",
  "DURABLE_RECOVERY_NOT_PROVEN",
  "ABORT_IS_NOT_ROLLBACK",
  "RESET_IS_NOT_RECOVERY",
  "CLEANUP_IS_NOT_PURGE",
  "REPLAY_MATCHED_IS_NOT_BACKUP_OR_RESTORE",
  "AUTOMATED_VALIDATION_IS_NOT_HUMAN_VALIDATION",
  "NO_PILOT_OR_PRODUCTION_AUTHORIZATION"
] as const;

const teacherAdminKnownLimitIds = [
  "ISSUE_111_OPEN",
  "ISSUE_114_OPEN",
  "ISSUE_115_OPEN",
  "HUMAN_VALIDATION_WAIVED_BY_OWNER",
  "AI_ADVISORY_ONLY",
  "SIMULATION_CORE_IS_FORMAL_TRUTH_AUTHORITY"
] as const;

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function formalStateDigest(page: Page, token: string, tenant: string): Promise<string> {
  let snapshot: Record<string, unknown>;

  if (existsSync(PLAYWRIGHT_STORE_FILE)) {
    snapshot = JSON.parse(readFileSync(PLAYWRIGHT_STORE_FILE, "utf8")) as Record<string, unknown>;
  } else {
    const response = await page.request.get(`${apiBaseUrl}/api/v1/demo-state`, {
      headers: {
        authorization: `Bearer ${token}`,
        "x-tenant-id": tenant
      }
    });
    expect(response.ok()).toBe(true);
    const envelope = (await response.json()) as { data: Record<string, unknown> };
    snapshot = {
      courses: envelope.data.courses,
      parameterSets: "NOT_EXPOSED_ON_PRODUCT_READ_SURFACE",
      runs: envelope.data.runs,
      scenarioPackages: "NOT_EXPOSED_ON_PRODUCT_READ_SURFACE",
      settlementResults: envelope.data.latest_result ? [envelope.data.latest_result] : []
    };
  }

  return createHash("sha256")
    .update(
      JSON.stringify({
        courses: snapshot.courses,
        parameterSets: snapshot.parameterSets,
        runs: snapshot.runs,
        scenarioPackages: snapshot.scenarioPackages,
        settlementResults: snapshot.settlementResults
      })
    )
    .digest("hex");
}

async function signIn(
  page: Page,
  surface: "admin" | "student" | "teacher",
  input: { password: string; tenant: string; username: string }
): Promise<string> {
  const loginResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/v1/auth/login") && response.status() === 200
  );
  const login = page.locator(`section[aria-label="${surface} login"]`);
  await login.getByLabel("tenant").fill(input.tenant);
  await login.getByLabel("username").fill(input.username);
  await login.getByLabel("password").fill(input.password);
  await login
    .getByRole("button", {
      name: surface === "teacher" ? "教师登录" : surface === "student" ? "学员登录" : "管理员登录"
    })
    .click();
  await expect(page.getByText("signed in")).toBeVisible();
  const body = (await (await loginResponse).json()) as { data: { access_token: string } };
  return body.data.access_token;
}

async function verifyDisclosure(
  page: Page,
  expectedRoleBoundary: string,
  expectedSemanticIds: readonly string[],
  forbiddenSemanticIds: readonly string[] = [],
  forbiddenMarkers: readonly string[] = []
): Promise<void> {
  const panel = page.locator('section[aria-label="known limits product disclosure"]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "已知限制与内部使用说明" })).toBeVisible();

  const disclosureRequests: string[] = [];
  const recordRequest = (request: { method(): string; url(): string }): void => {
    disclosureRequests.push(`${request.method()} ${request.url()}`);
  };
  const clientStateBefore = await page.evaluate(() => ({
    cookie: document.cookie,
    localStorage: JSON.stringify({ ...localStorage }),
    sessionStorage: JSON.stringify({ ...sessionStorage })
  }));
  const requestCountBefore = await page.evaluate(
    () => performance.getEntriesByType("resource").length
  );
  page.on("request", recordRequest);
  await panel.getByText("查看完整限制").click();
  const visibleSemanticIds = await panel.locator("strong").allTextContents();
  expect(visibleSemanticIds).toEqual(
    expectedSemanticIds.map((semanticId) => expect.stringContaining(semanticId))
  );
  for (const forbiddenSemanticId of forbiddenSemanticIds) {
    await expect(panel.getByText(forbiddenSemanticId, { exact: false })).toHaveCount(0);
  }
  await expect(panel.getByText(expectedRoleBoundary, { exact: false })).toBeVisible();
  page.off("request", recordRequest);
  const requestCountAfter = await page.evaluate(
    () => performance.getEntriesByType("resource").length
  );
  expect(requestCountAfter).toBe(requestCountBefore);
  expect(disclosureRequests).toEqual([]);
  expect(
    await page.evaluate(() => ({
      cookie: document.cookie,
      localStorage: JSON.stringify({ ...localStorage }),
      sessionStorage: JSON.stringify({ ...sessionStorage })
    }))
  ).toEqual(clientStateBefore);

  const text = await panel.innerText();
  for (const marker of forbiddenMarkers) {
    expect(text).not.toContain(marker);
  }

  const overflowingElements = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        className: element.className,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tagName: element.tagName
      }))
  );
  expect(overflowingElements).toEqual([]);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
}

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
}

async function attachSurfaceScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string
): Promise<void> {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
}

test("Teacher and Student consume role-safe Known Limits without formal-state mutation", async ({
  page
}, testInfo) => {
  const consoleErrors = captureConsoleErrors(page);
  await page.setViewportSize({ height: 812, width: 375 });
  await page.goto(teacherBaseUrl);
  const teacherToken = await signIn(page, "teacher", {
    password: "teacher",
    tenant: "tenant_demo",
    username: "teacher"
  });
  const teacherDigest = await formalStateDigest(page, teacherToken, "tenant_demo");
  await verifyDisclosure(page, "教师操作仍受现有角色权限约束", [
    ...commonKnownLimitIds,
    ...teacherAdminKnownLimitIds
  ]);
  expect(await formalStateDigest(page, teacherToken, "tenant_demo")).toBe(teacherDigest);
  await attachSurfaceScreenshot(page, testInfo, "teacher-known-limits-mobile");

  await page.goto(studentBaseUrl);
  const studentToken = await signIn(page, "student", {
    password: "student",
    tenant: "tenant_demo",
    username: "student"
  });
  const studentDigest = await formalStateDigest(page, studentToken, "tenant_demo");
  await verifyDisclosure(
    page,
    "学习反馈不是正式成绩",
    commonKnownLimitIds,
    teacherAdminKnownLimitIds,
    [
      "state_true",
      "SettlementResult",
      "canonical_evidence_digest",
      "decision_batch_hash",
      "json_runtime_source_digest",
      "ParameterSet"
    ]
  );
  expect(await formalStateDigest(page, studentToken, "tenant_demo")).toBe(studentDigest);
  await attachSurfaceScreenshot(page, testInfo, "student-known-limits-mobile");
  expect(consoleErrors).toEqual([]);
});

test("Tenant and Platform Admin receive distinct authority-safe disclosures", async ({
  page
}, testInfo) => {
  const consoleErrors = captureConsoleErrors(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(adminBaseUrl);
  const tenantToken = await signIn(page, "admin", {
    password: "admin",
    tenant: "tenant_demo",
    username: "admin"
  });
  const tenantDigest = await formalStateDigest(page, tenantToken, "tenant_demo");
  await verifyDisclosure(page, "仅说明当前租户范围", [
    ...commonKnownLimitIds,
    ...teacherAdminKnownLimitIds
  ]);
  expect(await formalStateDigest(page, tenantToken, "tenant_demo")).toBe(tenantDigest);
  await attachSurfaceScreenshot(page, testInfo, "tenant-admin-known-limits-desktop");

  await page.goto(adminBaseUrl);
  const platformToken = await signIn(page, "admin", {
    password: "platform",
    tenant: "tenant_platform",
    username: "platform"
  });
  const platformDigest = await formalStateDigest(page, platformToken, "tenant_platform");
  await verifyDisclosure(page, "平台范围必须来自显式平台权限", [
    ...commonKnownLimitIds,
    ...teacherAdminKnownLimitIds
  ]);
  expect(await formalStateDigest(page, platformToken, "tenant_platform")).toBe(platformDigest);
  await attachSurfaceScreenshot(page, testInfo, "platform-admin-known-limits-desktop");
  expect(consoleErrors).toEqual([]);
});
